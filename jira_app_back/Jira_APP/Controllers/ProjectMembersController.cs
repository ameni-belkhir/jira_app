using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Application.DTO;
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
    [Route("api/projects")]
    public class ProjectMembersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IEmailService _emailService;
        private readonly INotificationService _notificationService;
        private readonly ILogger<ProjectMembersController> _logger;

        public ProjectMembersController(
            ApplicationDbContext db,
            IEmailService emailService,
            INotificationService notificationService,
            ILogger<ProjectMembersController> logger)
        {
            _db = db;
            _emailService = emailService;
            _notificationService = notificationService;
            _logger = logger;
        }

        [HttpGet("{projectId}/available-seniors")]
        public async Task<ActionResult<IEnumerable<AvailableUserDto>>> GetAvailableSeniors(int projectId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var callerId))
                return Unauthorized();

            // Admin global bypass; otherwise the caller must be ScrumMaster within the project
            if (!await IsAdminOrProjectRoleAsync(callerId, projectId, "ScrumMaster"))
                return Forbid();

            var existingIds = await _db.ProjectMembers
                .Where(pm => pm.ProjectId == projectId)
                .Select(pm => pm.UserId)
                .ToListAsync();

            var available = await _db.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Where(u => u.Role.Description == "Senior" && !existingIds.Contains(u.Id))
                .Select(u => new AvailableUserDto
                {
                    Id = u.Id,
                    Nom = u.Nom,
                    Prenom = u.Prenom,
                    Email = u.Email
                })
                .ToListAsync();

            return Ok(available);
        }

        [HttpGet("{projectId}/available-developers")]
        public async Task<ActionResult<IEnumerable<AvailableUserDto>>> GetAvailableDevelopers(int projectId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var callerId))
                return Unauthorized();

            // Admin global bypass; otherwise the caller must be ScrumMaster or Senior within the project
            if (!await IsAdminOrProjectRoleAsync(callerId, projectId, "ScrumMaster", "Senior"))
                return Forbid();

            var existingIds = await _db.ProjectMembers
                .Where(pm => pm.ProjectId == projectId)
                .Select(pm => pm.UserId)
                .ToListAsync();

            var available = await _db.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Where(u => u.Role.Description == "Developer" && !existingIds.Contains(u.Id))
                .Select(u => new AvailableUserDto
                {
                    Id = u.Id,
                    Nom = u.Nom,
                    Prenom = u.Prenom,
                    Email = u.Email
                })
                .ToListAsync();

            return Ok(available);
        }

        [HttpPost("{projectId}/members/senior")]
        public async Task<ActionResult<ProjectMemberResultDto>> AssignSenior(int projectId, [FromBody] AssignMemberDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var callerId))
                return Unauthorized();

            // Admin global bypass; otherwise the caller must be ScrumMaster within the project
            if (!await IsAdminOrProjectRoleAsync(callerId, projectId, "ScrumMaster"))
                return Forbid();

            var user = await _db.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == dto.UserId);

            if (user == null)
                return BadRequest("Utilisateur introuvable.");

            if (user.Role.Description != "Senior")
                return BadRequest("Cet utilisateur n'a pas le rôle Senior.");

            var alreadyMember = await _db.ProjectMembers
                .AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == dto.UserId);

            if (alreadyMember)
                return BadRequest("Cet utilisateur est déjà membre de ce projet.");

            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound("Projet introuvable.");

            var projectMember = new ProjectMember
            {
                ProjectId = projectId,
                UserId = dto.UserId,
                RoleInProject = "Senior",
                InvitedById = callerId,
                JoinedAt = DateTime.UtcNow
            };

            _db.ProjectMembers.Add(projectMember);
            await _db.SaveChangesAsync();

            var emailSent = false;
            try
            {
                var subject = "Vous avez été affecté à un nouveau projet";
                var body = $"Bonjour {user.Prenom} {user.Nom},\n\n"
                         + $"Vous avez été ajouté au projet « {project.Nom} » en tant que Senior.\n"
                         + "Connectez-vous à l'application Jira pour commencer à collaborer.\n\n"
                         + "Cordialement,\nL'équipe Jira";
                await _emailService.SendEmailAsync(user.Email, subject, body);
                emailSent = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Échec de l'envoi d'email à {Email} pour l'assignation Senior au projet {ProjectId}", user.Email, projectId);
            }

            try
            {
                await _notificationService.SendNotificationAsync(
                    user.Id,
                    "Affectation à un projet",
                    $"Vous avez été ajouté au projet « {project.Nom} » en tant que Senior.",
                    $"/projects/{projectId}",
                    "project");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Échec de l'envoi de notification à {UserId} pour l'assignation Senior au projet {ProjectId}", user.Id, projectId);
            }

            return Created(string.Empty, new ProjectMemberResultDto
            {
                UserId = dto.UserId,
                RoleInProject = "Senior",
                EmailSent = emailSent
            });
        }

        [HttpPost("{projectId}/members/developer")]
        public async Task<ActionResult<ProjectMemberResultDto>> AssignDeveloper(int projectId, [FromBody] AssignDeveloperDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var callerId))
                return Unauthorized();

            // Admin global bypass; otherwise the caller must be ScrumMaster or Senior within the project
            if (!await IsAdminOrProjectRoleAsync(callerId, projectId, "ScrumMaster", "Senior"))
                return Forbid();

            var user = await _db.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == dto.UserId);

            if (user == null)
                return BadRequest("Utilisateur introuvable.");

            if (user.Role.Description != "Developer")
                return BadRequest("Cet utilisateur n'a pas le rôle Developer.");

            var alreadyMember = await _db.ProjectMembers
                .AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == dto.UserId);

            if (alreadyMember)
                return BadRequest("Cet utilisateur est déjà membre de ce projet.");

            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound("Projet introuvable.");

            if (dto.SprintIds.Length > 0)
            {
                var validSprintCount = await _db.Sprints
                    .CountAsync(s => s.ProjectId == projectId && dto.SprintIds.Contains(s.Id));

                if (validSprintCount != dto.SprintIds.Length)
                    return BadRequest("Un ou plusieurs SprintIds n'appartiennent pas à ce projet.");
            }

            var projectMember = new ProjectMember
            {
                ProjectId = projectId,
                UserId = dto.UserId,
                RoleInProject = "Developer",
                InvitedById = callerId,
                JoinedAt = DateTime.UtcNow
            };

            _db.ProjectMembers.Add(projectMember);

            foreach (var sprintId in dto.SprintIds)
            {
                _db.SprintMembers.Add(new SprintMember
                {
                    SprintId = sprintId,
                    UserId = dto.UserId
                });
            }

            await _db.SaveChangesAsync();

            var emailSent = false;
            try
            {
                var subject = "Vous avez été affecté à un nouveau projet";
                var body = $"Bonjour {user.Prenom} {user.Nom},\n\n"
                         + $"Vous avez été ajouté au projet « {project.Nom} » en tant que Développeur.\n"
                         + "Connectez-vous à l'application Jira pour consulter vos sprints et vos tickets.\n\n"
                         + "Cordialement,\nL'équipe Jira";
                await _emailService.SendEmailAsync(user.Email, subject, body);
                emailSent = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Échec de l'envoi d'email à {Email} pour l'assignation Developer au projet {ProjectId}", user.Email, projectId);
            }

            try
            {
                await _notificationService.SendNotificationAsync(
                    user.Id,
                    "Affectation à un projet",
                    $"Vous avez été ajouté au projet « {project.Nom} » en tant que Développeur.",
                    $"/projects/{projectId}",
                    "project");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Échec de l'envoi de notification à {UserId} pour l'assignation Developer au projet {ProjectId}", user.Id, projectId);
            }

            return Created(string.Empty, new ProjectMemberResultDto
            {
                UserId = dto.UserId,
                RoleInProject = "Developer",
                EmailSent = emailSent
            });
        }

        /// <summary>
        /// Retourne tous les utilisateurs ayant le rôle global "ScrumMaster" (hors Admin).
        /// Accessible aux Admin et aux Scrum Masters (rôle global) pour la sélection multiple
        /// lors de la création d'un projet.
        /// </summary>
        [HttpGet("available-scrum-masters")]
        public async Task<ActionResult<IEnumerable<AvailableUserDto>>> GetAvailableScrumMasters()
        {
            // Seuls les Admin et les Scrum Masters (rôle global JWT) peuvent lister/créer des projets
            if (!User.IsInRole("Admin") && !User.IsInRole("ScrumMaster"))
                return Forbid();

            var available = await _db.Users
                .AsNoTracking()
                .Include(u => u.Role)
                .Where(u => u.Role.Description == "ScrumMaster")
                .Select(u => new AvailableUserDto
                {
                    Id = u.Id,
                    Nom = u.Nom,
                    Prenom = u.Prenom,
                    Email = u.Email
                })
                .ToListAsync();

            return Ok(available);
        }

        [HttpGet("{projectId}/members")]
        public async Task<ActionResult<IEnumerable<ProjectMemberDto>>> GetMembers(int projectId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var callerId))
                return Unauthorized();

            // Admin global bypass; otherwise the caller must be a member of the project
            if (!User.IsInRole("Admin"))
            {
                var callerRole = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, callerId, projectId);
                if (callerRole == null)
                    return Forbid();
            }

            var members = await _db.ProjectMembers
                .AsNoTracking()
                .Include(pm => pm.User)
                .Where(pm => pm.ProjectId == projectId)
                .Select(pm => new ProjectMemberDto
                {
                    UserId = pm.UserId,
                    Nom = pm.User.Nom,
                    Prenom = pm.User.Prenom,
                    Email = pm.User.Email,
                    RoleInProject = pm.RoleInProject,
                    JoinedAt = pm.JoinedAt
                })
                .ToListAsync();

            return Ok(members);
        }

        [HttpGet("{projectId}/my-role")]
        public async Task<ActionResult<MyRoleDto>> GetMyRole(int projectId)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var callerId))
                return Unauthorized();

            var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, callerId, projectId);

            return Ok(new MyRoleDto { RoleInProject = role });
        }

        /// <summary>
        /// Vérifie si l'utilisateur est Admin global OU possède l'un des rôles
        /// autorisés au sein du projet (rôle scoped au projet, pas le rôle global).
        /// </summary>
        private async Task<bool> IsAdminOrProjectRoleAsync(int userId, int projectId, params string[] allowedProjectRoles)
        {
            // Admin global bypass
            if (User.IsInRole("Admin"))
                return true;

            var callerRole = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId, projectId);
            return callerRole != null && allowedProjectRoles.Contains(callerRole);
        }
    }
}
