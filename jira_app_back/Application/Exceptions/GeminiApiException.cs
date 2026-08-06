using System;

namespace Application.Exceptions
{
    /// <summary>
    /// Erreur liée à l'appel de l'API Gemini (clé manquante/invalide, timeout,
    /// quota dépassé, service indisponible...). Mappée par le contrôleur en 502 Bad Gateway.
    /// </summary>
    public class GeminiApiException : Exception
    {
        public GeminiApiException(string message) : base(message) { }

        public GeminiApiException(string message, Exception innerException) : base(message, innerException) { }
    }
}
