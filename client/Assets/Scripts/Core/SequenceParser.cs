using UnityEngine;
using DG.Tweening;
using ProjectWeGo.Models;

namespace ProjectWeGo.Core
{
    public class SequenceParser : MonoBehaviour
    {
        [Header("Target Ship (Prototype)")]
        public Transform targetShip; // 프로토타입용 단일 함선 (실제로는 ID로 함선을 식별해야 함)

        public void PlaySimulation(TurnResult result)
        {
            if (result == null || result.simulation == null) return;

            Debug.Log($"[SequenceParser] 시뮬레이션 시작 - 총 {result.simulation.Count}개의 이벤트");

            // DOTween 타임라인 시퀀스 생성
            Sequence simSequence = DOTween.Sequence();

            foreach (var evt in result.simulation)
            {
                if (evt.eventType == "START")
                {
                    simSequence.InsertCallback(evt.time, () => Debug.Log($"[{evt.time}s] START: {evt.info}"));
                }
                else if (evt.eventType == "MOVE")
                {
                    float x = evt.x ?? 0f;
                    float y = evt.y ?? 0f;
                    
                    // targetShip이 있다면 1초간 이동하는 애니메이션 추가
                    if (targetShip != null)
                    {
                        simSequence.Insert(evt.time, targetShip.DOMove(new Vector3(x, y, 0), 1f).SetEase(Ease.Linear));
                    }
                    simSequence.InsertCallback(evt.time, () => Debug.Log($"[{evt.time}s] MOVE: x={x}, y={y}"));
                }
                else if (evt.eventType == "FIRE")
                {
                    simSequence.InsertCallback(evt.time, () => 
                    {
                        Debug.Log($"[{evt.time}s] FIRE! Type: {evt.type}");
                        // TODO: 파티클 생성 및 빔 연출 (LineRenderer 등) 추가
                    });
                }
                else if (evt.eventType == "HIT")
                {
                    simSequence.InsertCallback(evt.time, () => 
                    {
                        Debug.Log($"[{evt.time}s] HIT! Target: {evt.targetId}, Damage: {evt.damage}");
                        // TODO: 피격 파티클, 데미지 텍스트 팝업, 화면 흔들림 효과 추가
                    });
                }
                else if (evt.eventType == "END")
                {
                    simSequence.InsertCallback(evt.time, () => Debug.Log($"[{evt.time}s] END: {evt.info}"));
                }
            }

            // 시퀀스 재생 시작
            simSequence.Play();
        }
    }
}
