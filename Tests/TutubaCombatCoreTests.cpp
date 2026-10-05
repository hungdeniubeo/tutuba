#include "TutubaCombatModel.h"

#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

using namespace Tutuba::Combat;

namespace
{
void Check(bool condition, const char* expression, int line)
{
    if (!condition)
    {
        throw std::runtime_error(std::string("line ") + std::to_string(line) + ": " + expression);
    }
}

#define CHECK(expression) Check(static_cast<bool>(expression), #expression, __LINE__)
#define CHECK_EQ(actual, expected) Check((actual) == (expected), #actual " == " #expected, __LINE__)

Combatant Player(std::uint32_t id, Cell cell, int health = 20)
{
    return {id, Faction::Players, cell, health, health, 2, 2, 0};
}

Combatant Enemy(std::uint32_t id, Cell cell, int health = 20)
{
    return {id, Faction::Enemies, cell, health, health, 2, 2, 0};
}

CombatModel Fresh(std::vector<Combatant> actors = {Player(1, {1, 1}), Enemy(10, {4, 4})})
{
    return CombatModel(std::move(actors));
}

void TestActorStartsWithTwoAp()
{
    const auto model = Fresh();
    CHECK_EQ(model.actor(1)->actionPoints, 2);
    CHECK_EQ(model.actor(10)->actionPoints, 2);
}

void TestMoveUsesApAndRejectsIllegalCellsWithoutCost()
{
    auto model = Fresh();
    CHECK_EQ(model.move(1, {2, 1}), ActionError::None);
    CHECK_EQ(model.actor(1)->actionPoints, 1);
    CHECK_EQ(model.move(1, {3, 2}), ActionError::NotAdjacent);
    CHECK_EQ(model.move(1, {-1, 1}), ActionError::OutOfBounds);
    CHECK_EQ(model.actor(1)->actionPoints, 1);

    auto occupied = Fresh({Player(1, {1, 1}), Enemy(10, {2, 1})});
    CHECK_EQ(occupied.move(1, {2, 1}), ActionError::Occupied);
    CHECK_EQ(occupied.actor(1)->actionPoints, 2);
}

void TestApDoesNotCarryAndResetsAfterEnemyPhase()
{
    auto model = Fresh();
    CHECK_EQ(model.move(1, {2, 1}), ActionError::None);
    CHECK_EQ(model.move(1, {3, 1}), ActionError::None);
    CHECK_EQ(model.actor(1)->actionPoints, 0);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.round(), 2u);
    CHECK_EQ(model.actor(1)->actionPoints, 2);
}

void TestAttackStoresHalfDamageForTheFollowingRound()
{
    auto model = Fresh();
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 5), ActionError::None);
    CHECK_EQ(model.echoes().size(), 1u);
    CHECK_EQ(model.echoes()[0].damage, 2);
    CHECK_EQ(model.echoes()[0].activationRound, 2u);
    CHECK_EQ(model.actor(10)->health, 20);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(10)->health, 20);
    CHECK(model.echoes().empty());
    CHECK_EQ(model.result(), MatchResult::Ongoing);
}

void TestEmptyAttackAreaStillLeavesAStationaryEcho()
{
    auto model = Fresh({Player(1, {1, 1}), Enemy(10, {3, 1})});
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 7), ActionError::None);
    const auto saved = model.echoes()[0];
    CHECK_EQ(model.setEnemyIntent({10, IntentKind::Move, {2, 1}, {}, 0, false}), ActionError::None);
    CHECK_EQ(model.enemyIntents().size(), 1u);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(10)->position, (Cell{2, 1}));
    CHECK_EQ(model.actor(10)->health, 17);
    CHECK(model.echoes().empty());
    bool triggered = false;
    for (const auto& event : model.events())
    {
        triggered = triggered || (event.type == EventType::EchoTriggered && event.echoId == saved.id &&
            event.cells == saved.cells);
    }
    CHECK(triggered);
}

void TestDirectAttackAndEchoCanHitTheOwnersTeam()
{
    auto model = Fresh();
    CHECK_EQ(model.attack(1, {1, 1}, {{1, 1}}, 0, 3), ActionError::None);
    CHECK_EQ(model.actor(1)->health, 17);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(1)->health, 16);
}

void TestEchoResolvesOnlyOnceAndDoesNotCreateAnotherEcho()
{
    auto model = Fresh();
    CHECK_EQ(model.attack(1, {1, 1}, {{1, 1}}, 0, 4), ActionError::None);
    const auto id = model.echoes()[0].id;
    model.drainEvents();
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(1)->health, 14);
    CHECK(model.echoes().empty());
    model.drainEvents();
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(1)->health, 14);
    int triggered = 0;
    for (const auto& event : model.drainEvents())
    {
        if (event.type == EventType::EchoTriggered && event.echoId == id)
        {
            ++triggered;
        }
    }
    CHECK_EQ(triggered, 0);
}

void TestCombatEndsInDefeatIfBothTeamsDieInTheSameEchoBatch()
{
    auto model = Fresh({Player(1, {1, 1}, 3), Enemy(10, {4, 4}, 3)});
    CHECK_EQ(model.attack(1, {1, 1}, {{1, 1}, {4, 4}}, 0, 2), ActionError::None);
    CHECK_EQ(model.actor(1)->health, 1);
    CHECK_EQ(model.actor(10)->health, 1);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.result(), MatchResult::Defeat);
    CHECK_EQ(model.actor(1)->health, 0);
    CHECK_EQ(model.actor(10)->health, 0);
}

void TestDeadEchoOwnerDoesNotRemovePendingEcho()
{
    auto model = Fresh({Player(1, {1, 1}, 2), Player(2, {2, 2}), Enemy(10, {4, 4})});
    CHECK_EQ(model.attack(1, {4, 4}, {{4, 4}}, 6, 4), ActionError::None);
    model.setEnemyIntent({10, IntentKind::Attack, {1, 1}, {{1, 1}}, 2, false});
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK(model.echoes().empty());
    CHECK_EQ(model.actor(10)->health, 14);
    CHECK_EQ(model.actor(1)->health, 0);
    CHECK_EQ(model.result(), MatchResult::Ongoing);
    bool triggered = false;
    for (const auto& event : model.events())
    {
        triggered = triggered || (event.type == EventType::EchoTriggered && event.echoId == 1 && event.actorId == 1);
    }
    CHECK(triggered);
}

void TestEchoDamageFloorsAndHasMinimumOne()
{
    auto model = Fresh({Player(1, {1, 1}), Enemy(10, {2, 1})});
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 1), ActionError::None);
    CHECK_EQ(model.echoes()[0].damage, 1);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(10)->health, 18);
}

void TestEmptyAttackConsumesApAndCreatesEcho()
{
    auto model = Fresh();
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 5), ActionError::None);
    CHECK_EQ(model.actor(1)->actionPoints, 1);
    CHECK_EQ(model.echoes().size(), 1u);
}

void TestShiftEchoUsesOneApAndOneTeamQuotaWhileKeepingDeadline()
{
    auto model = Fresh({Player(1, {1, 1}), Player(2, {1, 2}), Enemy(10, {4, 4})});
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 5), ActionError::None);
    const Echo saved = model.echoes()[0];
    CHECK_EQ(model.shiftEcho(2, saved.id, {1, 0}), ActionError::None);
    CHECK_EQ(model.actor(2)->actionPoints, 1);
    CHECK_EQ(model.echoes()[0].cells, (std::vector<Cell>{{3, 1}}));
    CHECK_EQ(model.echoes()[0].activationRound, saved.activationRound);
    CHECK_EQ(model.echoes()[0].damage, saved.damage);
    CHECK_EQ(model.shiftEcho(1, saved.id, {0, 1}), ActionError::ShiftAlreadyUsed);
    CHECK_EQ(model.actor(1)->actionPoints, 1);
}

void TestInvalidShiftDoesNotConsumeApOrQuota()
{
    auto model = Fresh();
    CHECK_EQ(model.attack(1, {0, 0}, {{0, 0}}, 2, 5), ActionError::None);
    const auto echoId = model.echoes()[0].id;
    CHECK_EQ(model.shiftEcho(1, echoId, {-1, 0}), ActionError::OutOfBounds);
    CHECK_EQ(model.actor(1)->actionPoints, 1);
    CHECK_EQ(model.shiftEcho(1, echoId, {1, 0}), ActionError::None);
}

void TestPushMovesOnlyIntoAnEmptyCellAndDoesNotMoveTheEcho()
{
    auto model = Fresh({Player(1, {1, 1}), Enemy(10, {2, 1})});
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 1, true), ActionError::None);
    CHECK_EQ(model.actor(10)->position, (Cell{3, 1}));
    CHECK_EQ(model.echoes()[0].cells, (std::vector<Cell>{{2, 1}}));
}

void TestPushIsBlockedByAnOccupiedCell()
{
    auto model = Fresh({Player(1, {1, 1}), Player(2, {3, 1}), Enemy(10, {2, 1})});
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 1, true), ActionError::None);
    CHECK_EQ(model.actor(10)->position, (Cell{2, 1}));
}

void TestEchoDamageAggregatesBeforeSimultaneousDeath()
{
    auto model = Fresh({Player(1, {1, 1}), Enemy(10, {4, 4}, 20)});
    CHECK_EQ(model.attack(1, {1, 1}, {{4, 4}}, 0, 3), ActionError::None);
    CHECK_EQ(model.attack(1, {1, 1}, {{4, 4}}, 0, 3), ActionError::None);
    CHECK_EQ(model.actor(10)->health, 14);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(10)->health, 12);
    int echoDamageEvents = 0;
    for (const auto& event : model.events())
    {
        if (event.type == EventType::DamageApplied && event.actorId == 10 && event.amount == 2)
        {
            ++echoDamageEvents;
        }
    }
    CHECK_EQ(echoDamageEvents, 1);
}

void TestShieldAbsorbsTheCombinedEchoDamage()
{
    // Initial shield is part of the data model, so this actor blocks direct and echo damage.
    std::vector<Combatant> actors = {Player(1, {1, 1}), Enemy(10, {4, 4}, 10)};
    actors[1].shield = 6;
    CombatModel model(std::move(actors));
    CHECK_EQ(model.attack(1, {1, 1}, {{4, 4}}, 0, 4), ActionError::None);
    CHECK_EQ(model.endPlayerTurn(), ActionError::None);
    CHECK_EQ(model.actor(10)->health, 10);
    CHECK_EQ(model.actor(10)->shield, 0);
}

void TestKillingLastEnemyEndsMatchAndClearsPendingEcho()
{
    auto model = Fresh({Player(1, {1, 1}), Enemy(10, {2, 1}, 1)});
    CHECK_EQ(model.attack(1, {2, 1}, {{2, 1}}, 1, 1), ActionError::None);
    CHECK_EQ(model.result(), MatchResult::Victory);
    CHECK(model.echoes().empty());
    CHECK_EQ(model.endPlayerTurn(), ActionError::WrongPhase);
}

} // namespace

int main()
{
    const std::vector<std::pair<const char*, std::function<void()>>> tests = {
        {"actor starts with two AP", TestActorStartsWithTwoAp},
        {"movement and invalid moves", TestMoveUsesApAndRejectsIllegalCellsWithoutCost},
        {"AP reset, no carry", TestApDoesNotCarryAndResetsAfterEnemyPhase},
        {"echo timing and damage", TestAttackStoresHalfDamageForTheFollowingRound},
        {"empty attacks leave fixed echoes", TestEmptyAttackAreaStillLeavesAStationaryEcho},
        {"friendly fire", TestDirectAttackAndEchoCanHitTheOwnersTeam},
        {"echo is single-use", TestEchoResolvesOnlyOnceAndDoesNotCreateAnotherEcho},
        {"simultaneous defeat", TestCombatEndsInDefeatIfBothTeamsDieInTheSameEchoBatch},
        {"dead echo owner", TestDeadEchoOwnerDoesNotRemovePendingEcho},
        {"echo minimum damage", TestEchoDamageFloorsAndHasMinimumOne},
        {"empty attack costs AP", TestEmptyAttackConsumesApAndCreatesEcho},
        {"shift echo quota and deadline", TestShiftEchoUsesOneApAndOneTeamQuotaWhileKeepingDeadline},
        {"invalid shift is free", TestInvalidShiftDoesNotConsumeApOrQuota},
        {"push moves into an empty cell", TestPushMovesOnlyIntoAnEmptyCellAndDoesNotMoveTheEcho},
        {"push collision is blocked", TestPushIsBlockedByAnOccupiedCell},
        {"echo damage is simultaneous", TestEchoDamageAggregatesBeforeSimultaneousDeath},
        {"shield absorbs echo damage", TestShieldAbsorbsTheCombinedEchoDamage},
        {"victory clears pending echoes", TestKillingLastEnemyEndsMatchAndClearsPendingEcho},
    };
    int failures = 0;
    for (const auto& test : tests)
    {
        try
        {
            test.second();
            std::cout << "PASS " << test.first << '\n';
        }
        catch (const std::exception& error)
        {
            ++failures;
            std::cerr << "FAIL " << test.first << ": " << error.what() << '\n';
        }
    }
    std::cout << tests.size() - static_cast<std::size_t>(failures) << '/' << tests.size() << " passed\n";
    return failures == 0 ? 0 : 1;
}
