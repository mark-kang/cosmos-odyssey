using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;
using Newtonsoft.Json;
using ProjectWeGo.Models;

namespace ProjectWeGo.Network
{
    public class NetworkManager : MonoBehaviour
    {
        [Header("Server Settings")]
        public string serverUrl = "http://localhost:3000/api/turn/submit";

        public void SubmitTurn(string playerId, string actionData, Action<TurnResult> onSuccess, Action<string> onError)
        {
            StartCoroutine(PostTurnCoroutine(playerId, actionData, onSuccess, onError));
        }

        private IEnumerator PostTurnCoroutine(string playerId, string actionData, Action<TurnResult> onSuccess, Action<string> onError)
        {
            string jsonBody = $"{{\"playerId\":\"{playerId}\", \"action\":\"{actionData}\"}}";
            
            using (UnityWebRequest request = new UnityWebRequest(serverUrl, "POST"))
            {
                byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");

                yield return request.SendWebRequest();

                if (request.result == UnityWebRequest.Result.ConnectionError || request.result == UnityWebRequest.Result.ProtocolError)
                {
                    onError?.Invoke(request.error);
                }
                else
                {
                    string responseText = request.downloadHandler.text;
                    try
                    {
                        TurnResult result = JsonConvert.DeserializeObject<TurnResult>(responseText);
                        onSuccess?.Invoke(result);
                    }
                    catch (Exception e)
                    {
                        onError?.Invoke("JSON Parse Error: " + e.Message);
                    }
                }
            }
        }
    }
}
