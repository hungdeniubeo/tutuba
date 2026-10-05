#include "TutubaCombatModel.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>
#include <utility>

namespace Tutuba::Combat
{
CombatModel::CombatModel(std::vector<Combatant> combatants)
    : combatants_(std::move(combatants))
{
    if (combatants_.empty())
    {
        throw std::invalid_argument("A match needs at least one combatant on each faction.");
    }

    std::sort(combatants_.begin(), combatants_.end(),
        [](const Combatant& left, const Combatant& right) { return left.id < right.id; });

    bool hasPlayers = false;
    bool hasEnemies = false;
    for (std::size_t index = 0; index < combatants_.size(); ++index)
    {
        const Combatant& combatant = combatants_[index];
        if (combatant.id == 0 || (index > 0 && combatants_[index - 1].id == combatant.id))
        {
            throw std::invalid_argument("Combatant IDs must be unique and non-zero.");
        }
        if (!inBounds(combatant.position) || combatant.maxHealth <= 0 ||
            combatant.health <= 0 || combatant.health > combatant.maxHealth ||
            combatant.maxActionPoints < 0 || combatant.actionPoints < 0 ||
            combatant.actionPoints > combatant.maxActionPoints || combatant.shield < 0)
        {
            throw std::invalid_argument("Combatant position or initial stats are invalid.");
        }
        if (index > 0 && combatants_[index - 1].position == combatant.position)
        {
            throw std::invalid_argument("A cell can contain only one living combatant.");
        }
        hasPlayers = hasPlayers || combatant.faction == Faction::Players;
        hasEnemies = hasEnemies || combatant.faction == Faction::Enemies;
    }
    if (!hasPlayers || !hasEnemies)
    {
        throw std::invalid_argument("A match needs living combatants on both factions.");
    }
}

const Combatant* CombatModel::actor(const std::uint32_t id) const
{
    const auto found = std::lower_bound(combatants_.begin(), combatants_.end(), id,
        [](const Combatant& combatant, const std::uint32_t actorId) { return combatant.id < actorId; });
    return found != combatants_.end() && found->id == id ? &*found : nullptr;
}

std::vector<CombatEvent> CombatModel::drainEvents()
{
    std::vector<CombatEvent> result;
    result.swap(events_);
    return result;
}

bool CombatModel::inBounds(const Cell cell)
{
    return cell.x >= 0 && cell.x < BoardSize && cell.y >= 0 && cell.y < BoardSize;
}

int CombatModel::distance(const Cell left, const Cell right)
{
    return std::abs(left.x - right.x) + std::abs(left.y - right.y);
}

std::vector<Cell> CombatModel::uniqueCells(std::vector<Cell> cells)
{
    std::vector<Cell> unique;
    unique.reserve(cells.size());
    for (const Cell cell : cells)
    {
        if (std::find(unique.begin(), unique.end(), cell) == unique.end())
        {
            unique.push_back(cell);
        }
    }
    return unique;
}

Combatant* CombatModel::findActor(const std::uint32_t id)
{
    return const_cast<Combatant*>(std::as_const(*this).actor(id));
}

Combatant* CombatModel::livingActorAt(const Cell cell)
{
    const auto found = std::find_if(combatants_.begin(), combatants_.end(),
        [cell](const Combatant& combatant) { return combatant.health > 0 && combatant.position == cell; });
    return found == combatants_.end() ? nullptr : &*found;
}

bool CombatModel::cellOccupied(const Cell cell) const
{
    return std::any_of(combatants_.begin(), combatants_.end(),
        [cell](const Combatant& combatant) { return combatant.health > 0 && combatant.position == cell; });
}

ActionError CombatModel::validatePlayer(const std::uint32_t actorId, Combatant*& out)
{
    out = nullptr;
    if (result_ != MatchResult::Ongoing)
    {
        return ActionError::WrongPhase;
    }
    Combatant* combatant = findActor(actorId);
    if (!combatant)
    {
        return ActionError::UnknownActor;
    }
    if (combatant->health <= 0)
    {
        return ActionError::ActorDead;
    }
    if (combatant->faction != Faction::Players)
    {
        return ActionError::NotPlayer;
    }
    if (combatant->actionPoints < 1)
    {
        return ActionError::NotEnoughAp;
    }
    out = combatant;
    return ActionError::None;
}

bool CombatModel::moveActor(Combatant& combatant, const Cell destination, const bool consumeAp)
{
    if (!inBounds(destination) || distance(combatant.position, destination) != 1 ||
        cellOccupied(destination))
    {
        return false;
    }
    combatant.position = destination;
    if (consumeAp)
    {
        --combatant.actionPoints;
    }
    appendEvent(EventType::ActorMoved, combatant.id, 0, 1, {destination});
    return true;
}

ActionError CombatModel::move(const std::uint32_t actorId, const Cell destination)
{
    Combatant* combatant = nullptr;
    const ActionError validation = validatePlayer(actorId, combatant);
    if (validation != ActionError::None)
    {
        return validation;
    }
    if (!inBounds(destination))
    {
        return ActionError::OutOfBounds;
    }
    if (distance(combatant->position, destination) != 1)
    {
        return ActionError::NotAdjacent;
    }
    if (cellOccupied(destination))
    {
        return ActionError::Occupied;
    }
    moveActor(*combatant, destination, true);
    return ActionError::None;
}

void CombatModel::createEcho(const Combatant& owner, const std::vector<Cell>& cells, const int baseDamage)
{
    const int damage = std::max(1, baseDamage / 2);
    const std::uint64_t id = nextEchoId_++;
    echoes_.push_back({id, owner.id, owner.faction, damage, cells, round_ + 1});
    appendEvent(EventType::EchoCreated, owner.id, id, damage, cells);
}

void CombatModel::applyDamage(Combatant& target, const int damage, const std::uint64_t echoId)
{
    const int blocked = std::min(target.shield, damage);
    const int healthDamage = damage - blocked;
    target.shield -= blocked;
    target.health = std::max(0, target.health - healthDamage);
    appendEvent(EventType::DamageApplied, target.id, echoId, healthDamage);
    if (target.health == 0)
    {
        appendEvent(EventType::ActorDied, target.id, echoId);
    }
}

void CombatModel::resolveAttack(Combatant& attacker, const Cell anchor,
    const std::vector<Cell>& impactCells, const int baseDamage, const bool pushes)
{
    const std::uint32_t attackerId = attacker.id;
    const std::vector<Cell> cells = uniqueCells(impactCells);
    createEcho(attacker, cells, baseDamage);
    appendEvent(EventType::AttackResolved, attackerId, 0, baseDamage, cells);

    std::vector<std::uint32_t> hitActorIds;
    for (const Combatant& target : combatants_)
    {
        if (target.health > 0 &&
            std::find(cells.begin(), cells.end(), target.position) != cells.end())
        {
            hitActorIds.push_back(target.id);
        }
    }
    for (const std::uint32_t hitActorId : hitActorIds)
    {
        if (Combatant* target = findActor(hitActorId))
        {
            applyDamage(*target, baseDamage, 0);
        }
    }
    if (pushes)
    {
        const Combatant* liveAttacker = actor(attackerId);
        if (liveAttacker != nullptr && liveAttacker->health > 0)
        {
            pushTarget(*liveAttacker, anchor);
        }
    }
    evaluateResult();
}

ActionError CombatModel::attack(const std::uint32_t actorId, const Cell anchor,
    std::vector<Cell> impactCells, const int range, const int baseDamage, const bool pushes)
{
    Combatant* attacker = nullptr;
    const ActionError validation = validatePlayer(actorId, attacker);
    if (validation != ActionError::None)
    {
        return validation;
    }
    if (range < 0 || baseDamage <= 0 || impactCells.empty() || !inBounds(anchor) ||
        std::any_of(impactCells.begin(), impactCells.end(),
            [](const Cell cell) { return !inBounds(cell); }))
    {
        return ActionError::InvalidAttack;
    }
    if (distance(attacker->position, anchor) > range)
    {
        return ActionError::OutOfRange;
    }
    if (pushes && distance(attacker->position, anchor) != 1)
    {
        return ActionError::InvalidAttack;
    }
    --attacker->actionPoints;
    resolveAttack(*attacker, anchor, uniqueCells(std::move(impactCells)), baseDamage, pushes);
    return ActionError::None;
}

bool CombatModel::pushTarget(const Combatant& attacker, const Cell targetAnchor)
{
    Combatant* target = livingActorAt(targetAnchor);
    if (!target || target->faction == attacker.faction ||
        distance(attacker.position, target->position) != 1)
    {
        return false;
    }
    const Cell direction{target->position.x - attacker.position.x,
        target->position.y - attacker.position.y};
    const Cell destination{target->position.x + direction.x,
        target->position.y + direction.y};
    if (!inBounds(destination) || cellOccupied(destination))
    {
        return false;
    }
    return moveActor(*target, destination, false);
}

ActionError CombatModel::shiftEcho(const std::uint32_t actorId, const std::uint64_t echoId,
    const Cell offset)
{
    Combatant* actorToShift = nullptr;
    const ActionError validation = validatePlayer(actorId, actorToShift);
    if (validation != ActionError::None)
    {
        return validation;
    }
    if (std::abs(offset.x) + std::abs(offset.y) != 1)
    {
        return ActionError::InvalidAttack;
    }
    if (echoShiftUsed_)
    {
        return ActionError::ShiftAlreadyUsed;
    }
    auto echo = std::find_if(echoes_.begin(), echoes_.end(),
        [echoId](const Echo& candidate) { return candidate.id == echoId; });
    if (echo == echoes_.end())
    {
        return ActionError::EchoNotFound;
    }
    std::vector<Cell> moved;
    moved.reserve(echo->cells.size());
    for (const Cell cell : echo->cells)
    {
        const Cell destination{cell.x + offset.x, cell.y + offset.y};
        if (!inBounds(destination))
        {
            return ActionError::OutOfBounds;
        }
        moved.push_back(destination);
    }
    --actorToShift->actionPoints;
    echo->cells = std::move(moved);
    echoShiftUsed_ = true;
    appendEvent(EventType::EchoMoved, actorId, echoId, echo->damage, echo->cells);
    return ActionError::None;
}

ActionError CombatModel::setEnemyIntent(EnemyIntent intent)
{
    if (result_ != MatchResult::Ongoing)
    {
        return ActionError::WrongPhase;
    }
    Combatant* enemy = findActor(intent.enemyId);
    if (!enemy)
    {
        return ActionError::UnknownActor;
    }
    if (enemy->health <= 0)
    {
        return ActionError::ActorDead;
    }
    if (enemy->faction != Faction::Enemies)
    {
        return ActionError::NotEnemy;
    }
    if (enemyIntents_.count(intent.enemyId) != 0)
    {
        return ActionError::InvalidIntent;
    }

    if (intent.kind == IntentKind::Move)
    {
        if (!inBounds(intent.anchor) || !intent.impactCells.empty() ||
            intent.damage != 0 || intent.pushes)
        {
            return ActionError::InvalidIntent;
        }
    }
    else if (intent.kind == IntentKind::Attack)
    {
        if (!inBounds(intent.anchor) || intent.damage <= 0 || intent.impactCells.empty() ||
            std::any_of(intent.impactCells.begin(), intent.impactCells.end(),
                [](const Cell cell) { return !inBounds(cell); }) ||
            (intent.pushes && distance(enemy->position, intent.anchor) != 1))
        {
            return ActionError::InvalidIntent;
        }
        intent.impactCells = uniqueCells(std::move(intent.impactCells));
    }
    else
    {
        return ActionError::InvalidIntent;
    }

    enemyIntents_.emplace(intent.enemyId, std::move(intent));
    return ActionError::None;
}

ActionError CombatModel::endPlayerTurn()
{
    if (result_ != MatchResult::Ongoing)
    {
        return ActionError::WrongPhase;
    }

    const auto intents = enemyIntents_;
    enemyIntents_.clear();
    for (const auto& pair : intents)
    {
        if (result_ != MatchResult::Ongoing)
        {
            break;
        }
        const EnemyIntent& intent = pair.second;
        Combatant* enemy = findActor(intent.enemyId);
        if (!enemy || enemy->health <= 0)
        {
            appendEvent(EventType::EnemyIntentSkipped, intent.enemyId);
            continue;
        }
        if (intent.kind == IntentKind::Move)
        {
            if (!moveActor(*enemy, intent.anchor, false))
            {
                appendEvent(EventType::EnemyIntentSkipped, intent.enemyId, 0, 0, {intent.anchor});
            }
        }
        else
        {
            resolveAttack(*enemy, intent.anchor, intent.impactCells, intent.damage, intent.pushes);
        }
    }

    if (result_ != MatchResult::Ongoing)
    {
        return ActionError::None;
    }
    ++round_;
    resolveReadyEchoes();
    if (result_ != MatchResult::Ongoing)
    {
        return ActionError::None;
    }
    echoShiftUsed_ = false;
    for (Combatant& combatant : combatants_)
    {
        if (combatant.health > 0)
        {
            combatant.actionPoints = combatant.maxActionPoints;
        }
    }
    return ActionError::None;
}

void CombatModel::resolveReadyEchoes()
{
    std::vector<Echo> ready;
    std::vector<Echo> pending;
    ready.reserve(echoes_.size());
    pending.reserve(echoes_.size());
    for (const Echo& echo : echoes_)
    {
        (echo.activationRound <= round_ ? ready : pending).push_back(echo);
    }
    if (ready.empty())
    {
        return;
    }

    echoes_ = std::move(pending); // Consume before damage: echoes cannot re-echo.

    std::map<std::uint32_t, Cell> positions;
    for (const Combatant& combatant : combatants_)
    {
        if (combatant.health > 0)
        {
            positions.emplace(combatant.id, combatant.position);
        }
    }

    std::map<std::uint32_t, long long> totalDamage;
    for (const Echo& echo : ready)
    {
        appendEvent(EventType::EchoTriggered, echo.ownerId, echo.id, echo.damage, echo.cells);
        for (const auto& positionedActor : positions)
        {
            if (std::find(echo.cells.begin(), echo.cells.end(), positionedActor.second) != echo.cells.end())
            {
                long long& total = totalDamage[positionedActor.first];
                total = std::min(static_cast<long long>(std::numeric_limits<int>::max()),
                    total + static_cast<long long>(echo.damage));
            }
        }
    }
    for (const auto& damage : totalDamage)
    {
        if (Combatant* target = findActor(damage.first))
        {
            applyDamage(*target, static_cast<int>(damage.second), 0);
        }
    }
    evaluateResult();
}

void CombatModel::evaluateResult()
{
    if (result_ != MatchResult::Ongoing)
    {
        return;
    }
    bool anyPlayers = false;
    bool anyEnemies = false;
    for (const Combatant& combatant : combatants_)
    {
        if (combatant.health > 0)
        {
            anyPlayers = anyPlayers || combatant.faction == Faction::Players;
            anyEnemies = anyEnemies || combatant.faction == Faction::Enemies;
        }
    }
    if (!anyPlayers)
    {
        result_ = MatchResult::Defeat;
    }
    else if (!anyEnemies)
    {
        result_ = MatchResult::Victory;
    }
    if (result_ != MatchResult::Ongoing)
    {
        echoes_.clear();
        enemyIntents_.clear();
        appendEvent(EventType::MatchEnded);
        events_.back().result = result_;
    }
}

void CombatModel::appendEvent(const EventType type, const std::uint32_t actorId,
    const std::uint64_t echoId, const int amount, std::vector<Cell> cells)
{
    events_.push_back({type, actorId, echoId, amount, MatchResult::Ongoing, std::move(cells)});
}
} // namespace Tutuba::Combat
