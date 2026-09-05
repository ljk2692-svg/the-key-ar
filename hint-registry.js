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
    "MOTION_GUIDE",
    "CODE_RAIL",
    "SEQUENCE_REVEAL"
  ]);

  const CONFIG=Object.freeze({
    version:"24.2.0",
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
    "H-R1Q01":scaffold({id:"H-R1Q01",round:1,mission:"Q01",visualPreset:"COMPARE",nodeSeed:101,title:"COMPARE TRACE"}),
    "H-R1Q03":scaffold({id:"H-R1Q03",round:1,mission:"Q03",visualPreset:"ORDER",nodeSeed:103,title:"ORDER TRACE"}),
    "H-R1Q05":scaffold({id:"H-R1Q05",round:1,mission:"Q05",visualPreset:"DECODE",nodeSeed:105,title:"DECODE TRACE"}),
    "H-R1Q06":scaffold({id:"H-R1Q06",round:1,mission:"Q06",visualPreset:"COMBINE",nodeSeed:106,title:"COMBINE TRACE"}),

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

    "H-R3M01":scaffold({id:"H-R3M01",round:3,mission:"M01",visualPreset:"SEARCH",nodeSeed:301,title:"OBSERVE TRACE"}),
    "H-R3M02":scaffold({id:"H-R3M02",round:3,mission:"M02",visualPreset:"COMPARE",nodeSeed:302,title:"FILTER TRACE"}),
    "H-R3M03":scaffold({id:"H-R3M03",round:3,mission:"M03",visualPreset:"COMPARE",nodeSeed:303,title:"GESTURE TRACE"}),
    "H-R3M04":scaffold({id:"H-R3M04",round:3,mission:"M04",visualPreset:"RELATION",nodeSeed:304,title:"RELATION TRACE"}),
    "H-R3M05":scaffold({id:"H-R3M05",round:3,mission:"M05",visualPreset:"COMBINE",nodeSeed:305,title:"COMBINE TRACE"}),
    "H-R3M06":scaffold({id:"H-R3M06",round:3,mission:"M06",visualPreset:"REVEAL",nodeSeed:306,title:"MASK TRACE"}),

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
