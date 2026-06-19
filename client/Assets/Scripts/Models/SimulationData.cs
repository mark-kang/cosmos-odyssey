using System.Collections.Generic;
using Newtonsoft.Json;

namespace ProjectWeGo.Models
{
    [System.Serializable]
    public class TurnResult
    {
        public string status { get; set; }
        public string message { get; set; }
        public List<SimulationEvent> simulation { get; set; }
    }

    [System.Serializable]
    public class SimulationEvent
    {
        public float time { get; set; }
        
        [JsonProperty("event")]
        public string eventType { get; set; }
        
        public float? x { get; set; }
        public float? y { get; set; }
        public float? heading { get; set; }
        
        public string type { get; set; }
        public VectorData origin { get; set; }
        public VectorData target { get; set; }
        
        public int? damage { get; set; }
        public string targetId { get; set; }
        
        public string info { get; set; }
    }

    [System.Serializable]
    public class VectorData
    {
        public float x { get; set; }
        public float y { get; set; }
    }
}
