#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "TutubaGameMode.generated.h"

UCLASS()
class TUTUBA_API ATutubaGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    ATutubaGameMode();

protected:
    virtual void BeginPlay() override;
};
