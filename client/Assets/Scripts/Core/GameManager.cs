using UnityEngine;
using ProjectWeGo.Network;

namespace ProjectWeGo.Core
{
    public class GameManager : MonoBehaviour
    {
        public NetworkManager networkManager;
        public SequenceParser sequenceParser;

        private void Update()
        {
            // 임시 단축키: 스페이스바를 누르면 턴 시뮬레이션을 요청합니다.
            if (Input.GetKeyDown(KeyCode.Space))
            {
                Debug.Log("[GameManager] 스페이스바 입력 - 서버로 턴 제출 요청 중...");
                SubmitTestTurn();
            }
        }

        public void SubmitTestTurn()
        {
            if (networkManager == null || sequenceParser == null)
            {
                Debug.LogError("[GameManager] NetworkManager 또는 SequenceParser가 Inspector에 연결되지 않았습니다!");
                return;
            }

            networkManager.SubmitTurn(
                playerId: "playerA",
                actionData: "forward_attack_dummy", 
                onSuccess: (result) => 
                {
                    Debug.Log($"[GameManager] 서버 응답 성공! 상태: {result.status}");
                    // 데이터 수신 성공 시, 파서를 통해 DOTween 연출 재생
                    sequenceParser.PlaySimulation(result);
                },
                onError: (error) => 
                {
                    Debug.LogError($"[GameManager] 서버 통신 실패: {error}");
                }
            );
        }
    }
}
