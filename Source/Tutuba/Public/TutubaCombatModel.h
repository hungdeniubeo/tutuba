#pragma once

// Engine-independent deterministic turn rules. World actors, animation and UI
// can adapt this value model without allowing frame time to change outcomes.
#include <cstdint>
#include <map>
#include <optional>
#include <vector>

namespace Tutuba::Combat
{
constexpr int BoardSize = 6;
constexpr int ActionPointsPerRound = 2;

struct Cell
{
    int x = 0;
    int y = 0;

    bool operator==(const Cell& other) const { return x == other.x && y == other.y; }
    bool operator!=(const Cell& other) const { return !(*this == other); }
};

enum class Faction : std::uint8_t { Players, Enemies };
enum class MatchResult : std::uint8_t { Ongoing, Victory, Defeat };
enum class ActionError : std::uint8_t
{
    None,
    WrongPhase,
    UnknownActor,
    ActorDead,
    NotPlayer,
    NotEnemy,
    NotEnoughAp,
    OutOfBounds,
    NotAdjacent,
    Occupied,
    OutOfRange,
    InvalidAttack,
    InvalidIntent,
    EchoNotFound,
    ShiftAlreadyUsed
};

struct Combatant
{
    std::uint32_t id = 0;
    Faction faction = Faction::Players;
    Cell position;
    int health = 1;
    int maxHealth = 1;
    int actionPoints = ActionPointsPerRound;
    int maxActionPoints = ActionPointsPerRound;
    int shield = 0;
};

struct Echo
{
    std::uint64_t id = 0;
    std::uint32_t ownerId = 0;
    Faction ownerFaction = Faction::Players;
    int damage = 1;
    std::vector<Cell> cells;
    std::uint32_t activationRound = 1;
};

enum class IntentKind : std::uint8_t { Move, Attack };

struct EnemyIntent
{
    std::uint32_t enemyId = 0;
    IntentKind kind = IntentKind::Move;
    Cell anchor;
    std::vector<Cell> impactCells;
    int damage = 0;
    bool pushes = false;
};

enum class EventType : std::uint8_t
{
    ActorMoved,
    AttackResolved,
    EchoCreated,
    EchoMoved,
    EchoTriggered,
    DamageApplied,
    ActorDied,
    EnemyIntentSkipped,
    MatchEnded
};

struct CombatEvent
{
    EventType type = EventType::AttackResolved;
    std::uint32_t actorId = 0;
    std::uint64_t echoId = 0;
    int amount = 0;
    MatchResult result = MatchResult::Ongoing;
    std::vector<Cell> cells;
};

class CombatModel final
{
public:
    explicit CombatModel(std::vector<Combatant> combatants);

    unsigned round() const { return round_; }
    MatchResult result() const { return result_; }
    bool playerTurnOpen() const { return result_ == MatchResult::Ongoing; }
    const Combatant* actor(std::uint32_t id) const;
    const std::vector<Combatant>& combatants() const { return combatants_; }
    const std::vector<Echo>& echoes() const { return echoes_; }
    const std::map<std::uint32_t, EnemyIntent>& enemyIntents() const { return enemyIntents_; }
    const std::vector<CombatEvent>& events() const { return events_; }
    std::vector<CombatEvent> drainEvents();

    ActionError move(std::uint32_t actorId, Cell destination);
    ActionError attack(std::uint32_t actorId, Cell anchor, std::vector<Cell> impactCells,
                       int range, int baseDamage, bool pushes = false);
    ActionError shiftEcho(std::uint32_t actorId, std::uint64_t echoId, Cell offset);
    ActionError setEnemyIntent(EnemyIntent intent);
    ActionError endPlayerTurn();

private:
    static bool inBounds(Cell cell);
    static int distance(Cell a, Cell b);
    static std::vector<Cell> uniqueCells(std::vector<Cell> cells);
    Combatant* findActor(std::uint32_t id);
    Combatant* livingActorAt(Cell cell);
    bool cellOccupied(Cell cell) const;
    ActionError validatePlayer(std::uint32_t actorId, Combatant*& out);
    bool moveActor(Combatant& actor, Cell destination, bool requirePlayer);
    bool pushTarget(const Combatant& attacker, Cell targetAnchor);
    void createEcho(const Combatant& owner, const std::vector<Cell>& cells, int baseDamage);
    void resolveAttack(Combatant& attacker, Cell anchor, const std::vector<Cell>& impactCells,
                       int baseDamage, bool pushes);
    void resolveReadyEchoes();
    void applyDamage(Combatant& target, int damage, std::uint64_t echoId);
    void evaluateResult();
    void appendEvent(EventType type, std::uint32_t actorId = 0, std::uint64_t echoId = 0,
                     int amount = 0, std::vector<Cell> cells = {});

    std::vector<Combatant> combatants_;
    std::vector<Echo> echoes_;
    std::map<std::uint32_t, EnemyIntent> enemyIntents_;
    std::vector<CombatEvent> events_;
    unsigned round_ = 1;
    std::uint64_t nextEchoId_ = 1;
    bool echoShiftUsed_ = false;
    MatchResult result_ = MatchResult::Ongoing;
};
} // namespace Tutuba::Combat
