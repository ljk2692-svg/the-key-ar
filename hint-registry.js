(function installKeyLensHintRegistry(global){
  "use strict";

  const PRESETS=Object.freeze([
    "COMPARE",
    "RELATION",
    "ORDER",
    "SEARCH",
    "COMBINE",
    "REVEAL",
    "DECODE",
    "OBSERVE",
    "PREFIX",
    "MOTION_GUIDE",
    "CODE_RAIL",
    "SEQUENCE_REVEAL"
  ]);

  const CONFIG=Object.freeze({
    version:"24.4.0",
    defaultAudience:"SCHOOL",
    defaultEventMode:"STANDARD_150",
    defaultRound:"ALL",
    tracking:Object.freeze({
      method:"pattern",
      patternRatio:.5,
      markerSize:1,
      maxMountedNodes:16,
      completedOnly:true
    }),
    eventModes:Object.freeze({
      FAST_120:Object.freeze({level2DelayMs:1400,level2Enabled:true}),
      STANDARD_150:Object.freeze({level2DelayMs:3200,level2Enabled:true}),
      STRATEGY_180:Object.freeze({level2DelayMs:5500,level2Enabled:true})
    })
  });

  const MAIN_HINT_BINDINGS=Object.freeze({
    "R1-Q02":Object.freeze({route:"AR01",key:"rotate",role:"MAIN EXPERIENCE · PERSPECTIVE"}),
    "R1-Q04":Object.freeze({route:"AR02",key:"analyze",role:"MAIN EXPERIENCE · RELATION",level2:"황씨부터 분석"}),
    "R2-M01":Object.freeze({route:"AR03",key:"activate",role:"MAIN EXPERIENCE · ACTION TRACE"}),
    "R2-M03":Object.freeze({route:"AR04",key:"decrypt",role:"MAIN EXPERIENCE · DATA TRACE"}),
    "FINAL":Object.freeze({route:"AR05",key:"assemble",role:"MAIN EXPERIENCE · FINAL REWARD"})
  });

  const complete=(data)=>Object.freeze({
    enabled:true,
    implementation:"COMPLETE",
    contentStatus:"CONFIRMED",
    replay:"ON_REACQUIRE",
    ...data
  });
  const scaffold=(data)=>Object.freeze({
    enabled:false,
    implementation:"SCAFFOLD",
    contentStatus:"MISSION_SOURCE_REQUIRED",
    replay:"ON_REACQUIRE",
    copy:null,
    ...data
  });
  const copy=(school1,school2,corporate1=school1,corporate2=school2)=>Object.freeze({
    SCHOOL:Object.freeze({level1:Object.freeze(school1),level2:school2?Object.freeze(school2):null}),
    CORPORATE:Object.freeze({level1:Object.freeze(corporate1),level2:corporate2?Object.freeze(corporate2):null})
  });

  const REGISTRY=Object.freeze({
    "H-R1Q01":complete({
      id:"H-R1Q01",round:1,mission:"Q01",visualPreset:"COMPARE",nodeSeed:101,title:"RELATION COMPARE",
      systemLabel:"HINT PROTOCOL · COMPARE",accent:"CYAN",
      copy:copy(
        {line1:"단어 하나씩 보지 마세요.",line2:"두 묶음의 관계를 같은 기준으로 비교하십시오."},
        {line1:"두 묶음에는 같은 규칙이 적용됩니다.",line2:"각 위치의 대응을 확인하십시오."},
        {line1:"개별 단어보다 두 묶음의 관계를 보십시오.",line2:"동일한 기준으로 비교하십시오."},
        {line1:"두 묶음에 공통으로 적용되는 규칙을 추적하십시오.",line2:"각 위치의 대응을 확인하십시오."}
      ),
      visual:Object.freeze({variant:"WORD_GROUPS",groups:2,itemsPerGroup:4})
    }),
    "H-R1Q03":complete({
      id:"H-R1Q03",round:1,mission:"Q03",visualPreset:"ORDER",nodeSeed:103,title:"CODE MAPPING",
      systemLabel:"HINT PROTOCOL · MAPPING",accent:"CYAN",
      copy:copy(
        {line1:"기호와 문자의 위치를 비교해보세요.",line2:"같은 순서의 대응 관계에 주목하십시오."},
        {line1:"각 기호를 하나씩 대응되는 문자로 바꾼 뒤",line2:"처음 제시된 순서를 다시 확인하세요."},
        {line1:"기호와 문자 배열의 위치 관계를 추적하십시오.",line2:"동일한 순서 기준을 적용하십시오."},
        {line1:"각 기호를 대응 문자로 변환한 뒤",line2:"원래 배열 순서를 유지하십시오."}
      ),
      visual:Object.freeze({variant:"CODE_MAPPING",sourceSlots:4,alphabetSlots:9})
    }),
    "H-R1Q05":complete({
      id:"H-R1Q05",round:1,mission:"Q05",visualPreset:"DECODE",nodeSeed:105,title:"DUAL STAGE DECODE",
      systemLabel:"HINT PROTOCOL · TWO STAGE",accent:"CYAN",
      copy:copy(
        {line1:"두 부분을 먼저 따로 해결해보세요.",line2:"서로 다른 규칙을 한 번에 섞지 마십시오."},
        {line1:"각 부분에서 얻은 결과를 따로 기록한 뒤",line2:"문제에 제시된 순서대로 연결하세요."},
        {line1:"두 데이터 영역을 독립적으로 해석하십시오.",line2:"각 영역에는 별도의 규칙이 있습니다."},
        {line1:"두 결과를 분리해 기록한 뒤",line2:"지정된 순서대로 결합하십시오."}
      ),
      visual:Object.freeze({variant:"TWO_STAGE",stages:2,outputSlots:4})
    }),
    "H-R1Q06":complete({
      id:"H-R1Q06",round:1,mission:"Q06",visualPreset:"COMBINE",nodeSeed:106,title:"TRIPLE DECODE",
      systemLabel:"HINT PROTOCOL · THREE STAGE",accent:"CYAN",
      copy:copy(
        {line1:"세 문제를 한 번에 풀려고 하지 마세요.",line2:"각 영역의 규칙을 따로 확인하십시오."},
        {line1:"각 소문제의 결과를 따로 기록한 뒤",line2:"왼쪽부터 제시된 순서로 연결하세요."},
        {line1:"세 데이터 영역을 독립적으로 분석하십시오.",line2:"규칙을 서로 섞지 마십시오."},
        {line1:"각 결과를 분리해 기록한 뒤",line2:"왼쪽에서 오른쪽 순서로 결합하십시오."}
      ),
      visual:Object.freeze({variant:"TRIPLE_DECODE",stages:3,outputSlots:4})
    }),

    "H-R2M02":complete({
      id:"H-R2M02",round:2,mission:"M02",visualPreset:"MOTION_GUIDE",nodeSeed:202,title:"COORDINATION LINK",
      systemLabel:"HINT PROTOCOL · MOTION GUIDE",accent:"CYAN",
      copy:copy(
        {line1:"한 점만 움직여서는 완성되지 않습니다.",line2:"움직임의 연결을 확인하십시오."},
        {line1:"여러 움직임이 만나는 중심을 확인하십시오.",line2:"동시에 조정해야 합니다."},
        {line1:"개별 제어만으로는 구조가 완성되지 않습니다.",line2:"연결된 움직임을 관찰하십시오."},
        {line1:"각 제어점을 하나의 중심에 맞추십시오.",line2:""}
      ),
      visual:Object.freeze({nodes:6,connections:6})
    }),

    "H-R3GUIDE":complete({
      id:"H-R3GUIDE",round:3,mission:"SYSTEM",visualPreset:"CODE_RAIL",nodeSeed:300,title:"FINAL CODE RAIL",
      systemLabel:"ROUND 3 · SYSTEM GUIDE",accent:"GOLD",
      copy:copy(
        {line1:"미션마다 하나의 값을 확보하십시오.",line2:"얻은 순서가 최종 코드의 순서입니다."},
        null,
        {line1:"각 미션에서 하나의 값을 회수하십시오.",line2:"획득 순서가 최종 배열을 결정합니다."},
        null
      ),
      visual:Object.freeze({slots:8})
    }),

    "H-R3M01":complete({
      id:"H-R3M01",round:3,mission:"M01",visualPreset:"OBSERVE",nodeSeed:301,title:"COMMON SIGNAL",
      systemLabel:"HINT PROTOCOL · OBSERVE",accent:"CYAN",
      copy:copy(
        {line1:"영상 하나의 내용보다",line2:"여러 영상에서 반복되는 공통점을 찾으십시오."},
        {line1:"모든 영상이 함께 가리키는",line2:"장소 또는 단어를 확인하십시오."},
        {line1:"각 기록의 차이보다 반복되는 신호를 보십시오.",line2:""},
        {line1:"모든 기록이 가리키는 공통 위치나 명칭을 추적하십시오.",line2:""}
      ),
      visual:Object.freeze({frames:4,converge:true})
    }),
    "H-R3M02":complete({
      id:"H-R3M02",round:3,mission:"M02",visualPreset:"COMPARE",nodeSeed:302,title:"FRAGMENT FILTER",
      systemLabel:"HINT PROTOCOL · FRAGMENT",accent:"CYAN",
      copy:copy(
        {line1:"분절된 문자를 순서대로 이어 읽어보세요.",line2:"먼저 하나의 단어를 완성하십시오."},
        {line1:"완성된 단어의 뜻과",line2:"보기의 범주를 하나씩 비교하세요."},
        {line1:"분리된 문자 조각을 원래 순서로 결합하십시오.",line2:"먼저 하나의 의미를 복원하십시오."},
        {line1:"복원된 단어와",line2:"각 범주의 의미를 대조하십시오."}
      ),
      visual:Object.freeze({variant:"FRAGMENT_FILTER",fragments:8,categories:4})
    }),
    "H-R3M03":complete({
      id:"H-R3M03",round:3,mission:"M03",visualPreset:"COMPARE",nodeSeed:303,title:"GESTURE VERIFY",
      systemLabel:"HINT PROTOCOL · VISUAL VERIFY",accent:"CYAN",
      copy:copy(
        {line1:"모든 손을 같은 기준으로 비교하세요.",line2:"하나씩 차분히 검증하십시오."},
        {line1:"손가락 수뿐 아니라",line2:"방향과 모양까지 함께 비교해보세요."},
        {line1:"모든 제스처에 동일한 검증 기준을 적용하십시오.",line2:"개별 인상에 의존하지 마십시오."},
        {line1:"수량·방향·형태를 함께 비교하십시오.",line2:"세 기준을 끝까지 유지하십시오."}
      ),
      visual:Object.freeze({variant:"GESTURE_VERIFY",items:5,criteria:3})
    }),
    "H-R3M04":complete({
      id:"H-R3M04",round:3,mission:"M04",visualPreset:"RELATION",nodeSeed:304,title:"CODE ROTATION",
      systemLabel:"HINT PROTOCOL · ROTATE CLUE",accent:"GOLD",
      copy:copy(
        {line1:"보이는 방향이 전부는 아닙니다.",line2:"남겨진 기호의 관점을 바꿔보세요."},
        {line1:"이미지 또는 기호를 90도 돌려",line2:"다시 확인해보세요."},
        {line1:"현재 방향만으로 결론 내리지 마십시오.",line2:"기호의 관점을 전환하십시오."},
        {line1:"전체 기호 배열을 90도 회전해",line2:"새로운 의미를 확인하십시오."}
      ),
      visual:Object.freeze({variant:"ROTATE_CLUE",clues:5,rotationDegrees:90,options:5})
    }),
    "H-R3M05":complete({
      id:"H-R3M05",round:3,mission:"M05",visualPreset:"COMBINE",nodeSeed:305,title:"DUAL FRAGMENT",
      systemLabel:"HINT PROTOCOL · COMBINE",accent:"CYAN",
      copy:copy(
        {line1:"그림과 단어를 각각 따로 해석해보세요.",line2:"두 결과는 마지막에 연결됩니다."},
        {line1:"그림은 보는 방향을 바꿔보고,",line2:"단어의 한국어 의미도 생각해보세요."},
        {line1:"두 단서를 독립적으로 해석하십시오.",line2:"마지막 단계에서 결합됩니다."},
        {line1:"이미지의 방향과 단어의 의미를 각각 변환하십시오.",line2:""}
      ),
      visual:Object.freeze({fragments:2,rotateLeft:true,merge:true})
    }),
    "H-R3M06":complete({
      id:"H-R3M06",round:3,mission:"M06",visualPreset:"PREFIX",nodeSeed:306,title:"COMMON PREFIX",
      systemLabel:"HINT PROTOCOL · WORD TRANSFORM",accent:"CYAN",
      copy:copy(
        {line1:"다섯 단어에 모두 같은 규칙이 적용됩니다.",line2:"바뀌는 위치를 함께 확인하십시오."},
        {line1:"각 단어의 앞에",line2:"같은 알파벳 한 글자를 붙여보세요."},
        {line1:"모든 데이터에 하나의 변환 규칙이 적용됩니다.",line2:"같은 위치를 확인하십시오."},
        {line1:"각 단어 앞의 동일한 문자 슬롯을 검증하십시오.",line2:"완성 결과는 실제 단어여야 합니다."}
      ),
      visual:Object.freeze({words:5,sharedPrefix:true})
    }),

    "H-R3M07":complete({
      id:"H-R3M07",round:3,mission:"M07",visualPreset:"SEQUENCE_REVEAL",nodeSeed:307,title:"FOUR-POINT RECOVERY",
      systemLabel:"HINT PROTOCOL · SEQUENCE + REVEAL",accent:"GOLD",
      copy:copy(
        {line1:"네 곳에서 하나씩.",line2:"찾은 것을 순서대로 연결하십시오."},
        {line1:"빛 아래에서 나타난 문자를 모으십시오.",line2:"발견한 순서를 유지하십시오."},
        {line1:"네 지점에는 각각 하나의 조각이 남아 있습니다.",line2:"회수 순서대로 연결하십시오."},
        {line1:"빛이 드러낸 문자를 수집하십시오.",line2:""}
      ),
      visual:Object.freeze({panels:4,slots:4,book:true,lightSweep:true})
    }),

    "H-R3M08":complete({
      id:"H-R3M08",round:3,mission:"M08",visualPreset:"SEARCH",nodeSeed:308,title:"NEAR FIELD RECOVERY",
      systemLabel:"HINT PROTOCOL · FIELD SEARCH",accent:"CYAN",
      copy:copy(
        {line1:"해답은 새로 나타난 것이 아닙니다.",line2:"처음부터 가까이에 있던 것을 다시 보십시오."},
        {line1:"사람보다, 그가 계속 지니고 있던 것에 주목하십시오.",line2:""},
        {line1:"신호는 처음부터 현장 안에 있었습니다.",line2:"가까운 FIELD OBJECT를 다시 관찰하십시오."},
        {line1:"인물이 아니라 지속적으로 지닌 오브젝트를 추적하십시오.",line2:""}
      ),
      visual:Object.freeze({figures:5,fieldObject:"FIELD_LOG",rotationDegrees:180,nodePulse:true})
    })
  });

  global.KEY_LENS_HINT_PRESETS=PRESETS;
  global.KEY_LENS_HINT_CONFIG=CONFIG;
  global.KEY_LENS_MAIN_HINT_BINDINGS=MAIN_HINT_BINDINGS;
  global.KEY_LENS_HINT_REGISTRY=REGISTRY;
})(window);
