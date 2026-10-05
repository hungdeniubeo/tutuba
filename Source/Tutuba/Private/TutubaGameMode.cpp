#include "TutubaGameMode.h"

#include "TutubaArena.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"

ATutubaGameMode::ATutubaGameMode()
{
    DefaultPawnClass = nullptr;
}

void ATutubaGameMode::BeginPlay()
{
    Super::BeginPlay();
    APlayerController* Controller = UGameplayStatics::GetPlayerController(this, 0);
    if (!Controller)
    {
        return;
    }
    for (TActorIterator<ATutubaArena> It(GetWorld()); It; ++It)
    {
        Controller->bAutoManageActiveCameraTarget = false;
        Controller->SetViewTarget(*It);
        Controller->bShowMouseCursor = true;
        Controller->SetInputMode(FInputModeGameAndUI());
        return;
    }
    UE_LOG(LogTemp, Error, TEXT("TUTUBA: Arena missing. Generate and open /Game/Maps/L_Tutuba."));
}
