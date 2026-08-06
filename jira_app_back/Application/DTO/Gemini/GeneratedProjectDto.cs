using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace Application.DTO.Gemini
{
    /// <summary>
    /// Plan de projet généré par Gemini (PREVIEW) puis validé/édité par l'utilisateur
    /// avant la création réelle via confirm-project-plan.
    /// </summary>
    public class GeneratedProjectDto
    {
        [JsonPropertyName("projectName")]
        public string ProjectName { get; set; } = string.Empty;

        [JsonPropertyName("projectDescription")]
        public string ProjectDescription { get; set; } = string.Empty;

        [JsonPropertyName("sprints")]
        public List<GeneratedSprintDto> Sprints { get; set; } = new List<GeneratedSprintDto>();
    }

    public class GeneratedSprintDto
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("goal")]
        public string? Goal { get; set; }

        [JsonPropertyName("tickets")]
        public List<GeneratedTicketDto> Tickets { get; set; } = new List<GeneratedTicketDto>();
    }

    public class GeneratedTicketDto
    {
        [JsonPropertyName("titre")]
        public string Titre { get; set; } = string.Empty;

        [JsonPropertyName("description")]
        public string Description { get; set; } = string.Empty;

        /// <summary>Valeurs acceptées : "BAS" | "MOYENNE" | "HAUTE" | "CRITIQUE".</summary>
        [JsonPropertyName("priority")]
        public string Priority { get; set; } = "MOYENNE";
    }
}
