using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Application.DTO.Gemini;
using Application.Exceptions;
using Application.Interfaces;
using Domain.Entity;
using Infrastructure.Persistence;
using Jira_APP.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/gemini")]
    public class GeminiController : ControllerBase
    {
        private readonly IGeminiService _geminiService;
        private readonly ApplicationDbContext _db;
        private readonly ILogger<GeminiController> _logger;

        public GeminiController(
            IGeminiService geminiService,
            ApplicationDbContext db,
            ILogger<GeminiController> logger)
        {
            _geminiService = geminiService;
            _db = db;
            _logger = logger;
        }

        private async Task<int?> GetUserIdAsync()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !int.TryParse(claim, out var id))
                return null;
            return id;
        }

        /// <summary>
        /// PREVIEW : génère un plan de projet complet (sprints + tickets) via Gemini.
        /// Ne crée rien en base — l'utilisateur doit valider via confirm-project-plan.
        /// </summary>
        [Authorize(Roles = "ScrumMaster,Admin")]
        [HttpPost("generate-project-plan")]
        public async Task<IActionResult> GenerateProjectPlan([FromBody] GeminiPromptRequestDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            try
            {
                var plan = await _geminiService.GenerateProjectPlanAsync(dto.Prompt);
                return Ok(plan);
            }
            catch (GeminiApiException ex)
            {
                _logger.LogError(ex, "Gemini API a échoué pour generate-project-plan.");
                return StatusCode(StatusCodes.Status502BadGateway, new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Réponse Gemini malformée pour generate-project-plan.");
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Réponse IA invalide, réessayez" });
            }
        }

        /// <summary>
        /// PREVIEW : génère des sprints/tickets à ajouter à un projet EXISTANT via Gemini.
        /// Vérifie que l'appelant est ScrumMaster ou Senior de ce projet.
        /// </summary>
        [Authorize(Roles = "ScrumMaster,Senior")]
        [HttpPost("projects/{projectId}/generate-sprint-plan")]
        public async Task<IActionResult> GenerateSprintPlan(int projectId, [FromBody] GeminiPromptRequestDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var projectExists = await _db.Projects.AsNoTracking().AnyAsync(p => p.Id == projectId);
            if (!projectExists) return NotFound();

            var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId.Value, projectId);
            if (role != "ScrumMaster" && role != "Senior")
                return Forbid();

            try
            {
                var plan = await _geminiService.GenerateProjectPlanAsync(dto.Prompt);
                return Ok(plan);
            }
            catch (GeminiApiException ex)
            {
                _logger.LogError(ex, "Gemini API a échoué pour generate-sprint-plan (projet {ProjectId}).", projectId);
                return StatusCode(StatusCodes.Status502BadGateway, new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Réponse Gemini malformée pour generate-sprint-plan (projet {ProjectId}).", projectId);
                return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Réponse IA invalide, réessayez" });
            }
        }

        /// <summary>
        /// Crée RÉELLEMENT le Project + Sprints + Tickets à partir du plan validé/édité.
        /// Le créateur devient automatiquement ScrumMaster du projet (comme ProjectsController).
        /// </summary>
        [Authorize(Roles = "ScrumMaster,Admin")]
        [HttpPost("confirm-project-plan")]
        public async Task<IActionResult> ConfirmProjectPlan([FromBody] GeneratedProjectDto plan)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(plan.ProjectName))
                return BadRequest(new { error = "Le nom du projet est requis." });

            var project = new Project
            {
                Nom = plan.ProjectName,
                Responsable = plan.ProjectName,
                Description = plan.ProjectDescription ?? string.Empty,
                CreatedById = userId.Value
            };

            // Le créateur devient automatiquement ScrumMaster du projet
            project.Members.Add(new ProjectMember
            {
                UserId = userId.Value,
                RoleInProject = "ScrumMaster",
                JoinedAt = DateTime.UtcNow
            });

            _db.Projects.Add(project);
            await _db.SaveChangesAsync();

            var sprintCount = 0;
            var ticketCount = 0;

            foreach (var sprintDto in plan.Sprints ?? Enumerable.Empty<GeneratedSprintDto>())
            {
                var sprint = new Sprint
                {
                    Name = sprintDto.Name,
                    Goal = sprintDto.Goal,
                    ProjectId = project.Id,
                    Status = SprintStatus.Planned
                };

                foreach (var ticketDto in sprintDto.Tickets ?? Enumerable.Empty<GeneratedTicketDto>())
                {
                    sprint.Tickets.Add(new Ticket
                    {
                        Titre = ticketDto.Titre,
                        Description = ticketDto.Description ?? string.Empty,
                        CreatorId = userId.Value,
                        ProjectId = project.Id,
                        Status = Status.A_FAIRE,
                        Priority = Enum.TryParse<Priority>(ticketDto.Priority, out var priority) ? priority : Priority.MOYENNE,
                        Color = "#ffffff",
                        DateCreation = DateTime.UtcNow
                    });
                    ticketCount++;
                }

                _db.Sprints.Add(sprint);
                sprintCount++;
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                projectId = project.Id,
                projectName = project.Nom,
                sprintCount,
                ticketCount
            });
        }
    }
}
