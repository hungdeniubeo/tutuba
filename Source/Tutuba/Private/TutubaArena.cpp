#include "TutubaArena.h"

#include "Camera/CameraComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/StaticMesh.h"
#include "UObject/ConstructorHelpers.h"

ATutubaArena::ATutubaArena()
{
    PrimaryActorTick.bCanEverTick = false;
    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    SetRootComponent(SceneRoot);

    Tiles = CreateDefaultSubobject<UInstancedStaticMeshComponent>(TEXT("Tiles"));
    Tiles->SetupAttachment(SceneRoot);
    Tiles->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    Tiles->SetCollisionResponseToAllChannels(ECR_Ignore);
    Tiles->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (Cube.Succeeded())
    {
        Tiles->SetStaticMesh(Cube.Object);
    }

    BoardCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("BoardCamera"));
    BoardCamera->SetupAttachment(SceneRoot);
    BoardCamera->bConstrainAspectRatio = true;
    BoardCamera->AspectRatio = 16.0f / 9.0f;
}

void ATutubaArena::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    Tiles->ClearInstances();
    const float SafeSpacing = FMath::Clamp(TileSpacing, 80.0f, 300.0f);
    const FVector Scale((SafeSpacing - 8.0f) / 100.0f, (SafeSpacing - 8.0f) / 100.0f, 0.16f);
    for (int32 Y = 0; Y < GridSize; ++Y)
    {
        for (int32 X = 0; X < GridSize; ++X)
        {
            Tiles->AddInstance(FTransform(FRotator::ZeroRotator,
                FVector(X * SafeSpacing, Y * SafeSpacing, -8.0f), Scale));
        }
    }

    const FVector Focus((GridSize - 1) * SafeSpacing * 0.5f,
        (GridSize - 1) * SafeSpacing * 0.5f, 40.0f);
    const FRotator ViewRotation(FMath::Clamp(CameraPitch, -80.0f, -25.0f), CameraYaw, 0.0f);
    BoardCamera->SetRelativeLocation(Focus - ViewRotation.Vector() * FMath::Clamp(CameraDistance, 800.0f, 4000.0f));
    BoardCamera->SetRelativeRotation(ViewRotation);
    BoardCamera->SetFieldOfView(FMath::Clamp(CameraFOV, 30.0f, 70.0f));
}

FVector ATutubaArena::CellToWorld(const FIntPoint Cell) const
{
    const float SafeSpacing = FMath::Clamp(TileSpacing, 80.0f, 300.0f);
    return GetActorTransform().TransformPosition(FVector(Cell.X * SafeSpacing, Cell.Y * SafeSpacing, 0.0f));
}
