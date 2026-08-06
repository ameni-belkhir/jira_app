using System.Threading;
using System.Threading.Tasks;
using Application.DTO.Gemini;

namespace Application.Interfaces
{
    public interface IGeminiService
    {
        /// <summary>
        /// Génère un plan de projet structuré (projet + sprints + tickets) à partir
        /// d'un prompt libre, via l'API Google Gemini. N'écrit rien en base.
        /// </summary>
        Task<GeneratedProjectDto> GenerateProjectPlanAsync(string prompt, CancellationToken cancellationToken = default);
    }
}
