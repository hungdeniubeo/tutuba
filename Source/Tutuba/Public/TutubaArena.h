#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TutubaArena.generated.h"

class UCameraComponent;
class UInstancedStaticMeshComponent;
class USceneComponent;

/** Milestone 1 blockout. Combat state will live outside presentation actors. */
UCLASS()
class TUTUBA_API ATutubaArena : public AActor
{
    GENERATED_BODY()

public:
    ATutubaArena();
    virtual void OnConstruction(const FTransform& Transform) override;

    static constexpr int32 GridSize = 6;

    UFUNCTION(BlueprintPure, Category = "Tutuba|Arena")
    FVector CellToWorld(FIntPoint Cell) const;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Tutuba|Arena")
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Tutuba|Arena")
    TObjectPtr<UInstancedStaticMeshComponent> Tiles;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Tutuba|Camera")
    TObjectPtr<UCameraComponent> BoardCamera;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tutuba|Arena", meta = (ClampMin = "80.0", ClampMax = "300.0"))
    float TileSpacing = 150.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tutuba|Camera", meta = (ClampMin = "-80.0", ClampMax = "-25.0"))
    float CameraPitch = -48.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tutuba|Camera")
    float CameraYaw = 45.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tutuba|Camera", meta = (ClampMin = "800.0", ClampMax = "4000.0"))
    float CameraDistance = 1800.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tutuba|Camera", meta = (ClampMin = "30.0", ClampMax = "70.0"))
    float CameraFOV = 42.0f;

    // Editable layout seeds for M2; no combatants are spawned in the M1 scaffold.
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tutuba|Spawn")
    TArray<FIntPoint> PlayerSpawnCells = { FIntPoint(1, 1), FIntPoint(1, 2) };

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tutuba|Spawn")
    TArray<FIntPoint> EnemySpawnCells = { FIntPoint(4, 2), FIntPoint(4, 3) };
};
