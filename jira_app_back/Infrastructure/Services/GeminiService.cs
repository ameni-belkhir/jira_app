using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Application.DTO.Gemini;
using Application.Exceptions;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Services
{
    public class GeminiService : IGeminiService
    {
private const string GeminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/{0}:generateContent?key={1}";
        private const string ModelDefault = "gemini-3.6-flash";

        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GeminiService> _logger;

        public GeminiService(HttpClient httpClient, IConfiguration configuration, ILogger<GeminiService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<GeneratedProjectDto> GenerateProjectPlanAsync(string prompt, CancellationToken cancellationToken = default)
        {
            var apiKey = _configuration["Gemini:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new GeminiApiException(
                    "Configuration Gemini:ApiKey introuvable : la clé API Gemini est vide ou absente. " +
                    "Enregistrez-la via « dotnet user-secrets set \"Gemini:ApiKey\" <clé> --project Jira_APP » " +
                    "ou dans appsettings.Local.json (jamais dans appsettings.json versionné).");
            }

            _logger.LogInformation("Clé Gemini chargée : {Prefix}... (modèle {Model})", apiKey[..4], _configuration["Gemini:Model"] ?? ModelDefault);

            var model = _configuration["Gemini:Model"] ?? ModelDefault;
            var escapedKey = Uri.EscapeDataString(apiKey);
            var url = string.Format(GeminiEndpoint, model, escapedKey);

            var requestBody = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[] { new { text = BuildSystemPrompt(prompt) } }
                    }
                },
generationConfig = new
                {
                    responseMimeType = "application/json"
                }
            };

            var payloadJson = JsonSerializer.Serialize(requestBody);
            var maskedUrl = url.Replace(escapedKey, apiKey[..4] + "…");
            _logger.LogInformation(
                "Appel Gemini → modèle {Model} | URL {Url} | payload {Payload}",
                model,
                maskedUrl,
                payloadJson);

var content = new StringContent(
                payloadJson,
                Encoding.UTF8,
                "application/json");

            string responseJson;
            try
            {
                using var response = await _httpClient.PostAsync(url, content, cancellationToken);
                responseJson = await response.Content.ReadAsStringAsync(cancellationToken);

                _logger.LogInformation(
                    "Réponse Gemini ← HTTP {(int)StatusCode} ({ReasonPhrase}) | corps {Body}",
                    (int)response.StatusCode,
                    response.ReasonPhrase,
                    responseJson);

                if (!response.IsSuccessStatusCode)
                {
                    throw new GeminiApiException(
                        $"L'API Gemini a échoué ({(int)response.StatusCode} {response.ReasonPhrase}) : {responseJson}");
                }
            }
            catch (OperationCanceledException ex)
            {
                _logger.LogError(ex, "Timeout lors de l'appel à l'API Gemini.");
                throw new GeminiApiException("L'appel à l'API Gemini a expiré. Réessayez.", ex);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Erreur réseau lors de l'appel à l'API Gemini.");
                throw new GeminiApiException($"Impossible de joindre l'API Gemini : {ex.Message}", ex);
            }

            var rawText = ExtractTextFromGeminiResponse(responseJson);
            return ParsePlan(rawText);
        }

        private static string BuildSystemPrompt(string prompt)
        {
            return $@"Tu es un assistant de planification de projets (méthodologie Scrum).
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans bloc markdown. Respecte strictement ce schéma :

{{
  ""projectName"": string,
  ""projectDescription"": string,
  ""sprints"": [
    {{
      ""name"": string,
      ""goal"": string,
      ""tickets"": [
        {{ ""titre"": string, ""description"": string, ""priority"": ""BAS"" | ""MOYENNE"" | ""HAUTE"" | ""CRITIQUE"" }}
      ]
    }}
  ]
}}

Contrainte : ""priority"" doit être exactement l'une de ces valeurs : ""BAS"", ""MOYENNE"", ""HAUTE"", ""CRITIQUE"".
Génère un plan cohérent et réaliste (plusieurs sprints, plusieurs tickets par sprint).

Demande de l'utilisateur :
{prompt}";
        }

        private static string ExtractTextFromGeminiResponse(string responseJson)
        {
            try
            {
                using var doc = JsonDocument.Parse(responseJson);
                if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
                    candidates.GetArrayLength() > 0 &&
                    candidates[0].TryGetProperty("content", out var content) &&
                    content.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0 &&
                    parts[0].TryGetProperty("text", out var text))
                {
                    return text.GetString() ?? string.Empty;
                }
            }
            catch (JsonException)
            {
                // fall through -> invalid response
            }

            throw new InvalidOperationException("Réponse IA invalide, réessayez");
        }

        private static GeneratedProjectDto ParsePlan(string rawText)
        {
            var cleaned = CleanMarkdownFences(rawText);

            try
            {
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var plan = JsonSerializer.Deserialize<GeneratedProjectDto>(cleaned, options);
                if (plan == null) throw new JsonException("Vide");

                // Validation minimale pour éviter un objet sans contenu exploitable
                if (string.IsNullOrWhiteSpace(plan.ProjectName))
                {
                    throw new JsonException("projectName manquant");
                }

                return plan;
            }
            catch (JsonException)
            {
                throw new InvalidOperationException("Réponse IA invalide, réessayez");
            }
        }

        private static string CleanMarkdownFences(string text)
        {
            var cleaned = text.Trim();

            if (cleaned.StartsWith("```", StringComparison.Ordinal))
            {
                var firstNewline = cleaned.IndexOf('\n');
                if (firstNewline > 0)
                {
                    cleaned = cleaned[(firstNewline + 1)..];
                }
                cleaned = cleaned.Trim();

                if (cleaned.EndsWith("```", StringComparison.Ordinal))
                {
                    cleaned = cleaned[..^3];
                }
            }

            return cleaned.Trim();
        }
    }
}
