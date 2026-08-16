using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class TicketsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IProjectAuthorizationService _projectAuthService;
        private readonly IEmailService _emailService;
        private readonly INotificationService _notificationService;
        private readonly ILogger<TicketsController> _logger;

        public TicketsController(
            ApplicationDbContext db,
            IProjectAuthorizationService projectAuthService,
            IEmailService emailService,
            INotificationService notificationService,
            ILogger<TicketsController> logger)
        {
            _db = db;
            _projectAuthService = projectAuthService;
            _emailService = emailService;
            _notificationService = notificationService;
            _logger = logger;
        }

        private async Task<int?> GetUserIdAsync()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !int.TryParse(claim, out var id))
                return null;
            return id;
        }

        private static TicketDto MapToDto(Ticket t, bool hasSubTickets = false) => new TicketDto
        {
            Id = t.Id,
            Titre = t.Titre,
            Description = t.Description,
            CreatorId = t.CreatorId,
            AssigneeId = t.AssigneeId,
            ProjectId = t.ProjectId,
            SprintId = t.SprintId,
            ParentTicketId = t.ParentTicketId,
            Status = t.Status.ToString(),
            Priority = t.Priority.ToString(),
            DateCreation = t.DateCreation,
            DateResolution = t.DateResolution,
            Color = t.Color ?? "#ffffff",
            HasSubTickets = hasSubTickets
        };

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TicketDto>>> Get()
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var userProjectIds = await _db.ProjectMembers
                .Where(pm => pm.UserId == userId.Value)
                .Select(pm => pm.ProjectId)
                .ToListAsync();

            var isDeveloper = User.IsInRole("Developer");

            // L'Admin global voit tous les tickets (permission suprême).
            // Un Developer ne voit que les tickets qui lui sont explicitement assignés.
            var items = await _db.Tickets
                .AsNoTracking()
                .Where(t => t.ProjectId == null || userProjectIds.Contains(t.ProjectId.Value) || User.IsInRole("Admin"))
                .Where(t => !isDeveloper || t.AssigneeId == userId.Value)
                .ToListAsync();

            var parentIds = await _db.Tickets
                .Where(t => t.ParentTicketId != null && items.Select(i => i.Id).Contains(t.ParentTicketId.Value))
                .Select(t => t.ParentTicketId)
                .Distinct()
                .ToListAsync();

            var parentIdsSet = parentIds.ToHashSet();

            var dtos = items.Select(t => MapToDto(t, parentIdsSet.Contains(t.Id)));
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TicketDto>> GetById(int id)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var item = await _db.Tickets.FindAsync(id);
            if (item == null) return NotFound();

            if (item.ProjectId != null)
            {
                var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, item.ProjectId.Value);
                if (role == null && !User.IsInRole("Admin"))
                    return Forbid();

                // Un Developer ne consulte que les tickets qui lui sont assignés.
                if (role == "Developer" && item.AssigneeId != userId.Value)
                    return Forbid();
            }

            var hasSubTickets = await _db.Tickets.AnyAsync(t => t.ParentTicketId == id);

            var subTickets = await _db.Tickets
                .AsNoTracking()
                .Where(t => t.ParentTicketId == id)
                .Where(t => !User.IsInRole("Developer") || t.AssigneeId == userId.Value)
                .ToListAsync();

            var dto = MapToDto(item, hasSubTickets);
            dto.SubTickets = subTickets.Select(s => MapToDto(s)).ToList();
            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<TicketDto>> Create([FromBody] CreateTicketDto dto)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(x => x.Value.Errors.Count > 0)
                    .ToDictionary(
                        kvp => kvp.Key,
                        kvp => kvp.Value.Errors.Select(e => e.ErrorMessage).ToArray()
                    );
                _logger.LogWarning("Validation échouée sur CreateTicket : {@Errors}", errors);
                return BadRequest(errors);
            }

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            string? callerRole = null;
            if (dto.ProjectId.HasValue)
            {
                callerRole = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, dto.ProjectId.Value);
                if (!User.IsInRole("Admin") && callerRole != "ScrumMaster")
                    return Forbid();
            }

            var creator = await _db.Users.FindAsync(dto.CreatorId);
            if (creator == null)
            {
                _logger.LogWarning("CreateTicket: CreatorId invalide {CreatorId}", dto.CreatorId);
                return BadRequest(new { CreatorId = "Utilisateur (creator) introuvable." });
            }

            if (dto.ProjectId.HasValue)
            {
                var project = await _db.Projects.FindAsync(dto.ProjectId.Value);
                if (project == null)
                {
                    _logger.LogWarning("CreateTicket: ProjectId invalide {ProjectId}", dto.ProjectId);
                    return BadRequest(new { ProjectId = "Projet introuvable." });
                }
            }

            if (dto.AssigneeId.HasValue)
            {
                var assignee = await _db.Users.FindAsync(dto.AssigneeId.Value);
                if (assignee == null)
                {
                    _logger.LogWarning("CreateTicket: AssigneeId invalide {AssigneeId}", dto.AssigneeId);
                    return BadRequest(new { AssigneeId = "Utilisateur (assignee) introuvable." });
                }
            }

            // Chaîne hiérarchique stricte : SM→Senior, Senior→Developer, Admin→libre.
            if (dto.ProjectId.HasValue)
            {
                var chainError = await ValidateAssigneeChainAsync(callerRole, dto.ProjectId.Value, dto.AssigneeId);
                if (chainError != null)
                    return BadRequest(new { AssigneeId = chainError });
            }

            if (dto.ParentTicketId.HasValue)
            {
                var parentTicket = await _db.Tickets.FindAsync(dto.ParentTicketId.Value);
                if (parentTicket == null)
                    return BadRequest(new { ParentTicketId = "Ticket parent introuvable." });

                if (dto.ProjectId.HasValue && parentTicket.ProjectId != dto.ProjectId)
                    return BadRequest(new { ParentTicketId = "Le ticket parent n'appartient pas au même projet." });
            }

            var ticket = new Ticket
            {
                Titre = dto.Titre,
                Description = dto.Description,
                CreatorId = dto.CreatorId,
                AssigneeId = dto.AssigneeId,
                ProjectId = dto.ProjectId,
                SprintId = dto.SprintId,
                ParentTicketId = dto.ParentTicketId,
                Status = Enum.TryParse<Domain.Entity.Status>(dto.Status ?? string.Empty, out var s) ? s : Domain.Entity.Status.A_FAIRE,
                Priority = Enum.TryParse<Domain.Entity.Priority>(dto.Priority ?? string.Empty, out var p) ? p : Domain.Entity.Priority.MOYENNE,
                DateCreation = DateTime.UtcNow,
                Color = string.IsNullOrEmpty(dto.Color) ? "#ffffff" : dto.Color
            };
            _db.Tickets.Add(ticket);
            await _db.SaveChangesAsync();

            var hasSubTickets = await _db.Tickets.AnyAsync(t => t.ParentTicketId == ticket.Id);

            // Notification du développeur affecté au ticket
            if (ticket.AssigneeId.HasValue)
            {
                var assignee = await _db.Users.FindAsync(ticket.AssigneeId.Value);
                if (assignee != null)
                {
                    try
                    {
                        await _emailService.SendEmailAsync(
                            assignee.Email,
                            "Ticket assigné",
                            $"Bonjour {assignee.Prenom} {assignee.Nom},\n\nLe ticket « {ticket.Titre} » vous a été assigné.\n\nCordialement,\nL'équipe Jira");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi d'email pour l'assignation du ticket {TicketId}", ticket.Id);
                    }

                    try
                    {
                        await _notificationService.SendNotificationAsync(
                            assignee.Id,
                            "Ticket assigné",
                            $"Le ticket « {ticket.Titre} » vous a été assigné.",
                            ticket.ProjectId.HasValue ? $"/projects/{ticket.ProjectId.Value}/tickets/{ticket.Id}" : $"/tickets/{ticket.Id}",
                            "ticket");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi de notification pour l'assignation du ticket {TicketId}", ticket.Id);
                    }
                }
            }

            // Notification du Scrum Master / des Seniors à la création d'un sous-ticket (issue de correction)
            if (ticket.ParentTicketId.HasValue && ticket.ProjectId.HasValue)
            {
                var managerIds = await _db.ProjectMembers
                    .Where(pm => pm.ProjectId == ticket.ProjectId.Value
                        && (pm.RoleInProject == "ScrumMaster" || pm.RoleInProject == "Senior")
                        && pm.UserId != ticket.CreatorId)
                    .Select(pm => pm.UserId)
                    .ToListAsync();

                foreach (var managerId in managerIds)
                {
                    try
                    {
                        await _notificationService.SendNotificationAsync(
                            managerId,
                            "Nouveau sous-ticket",
                            $"Un sous-ticket « {ticket.Titre} » a été créé.",
                            $"/projects/{ticket.ProjectId.Value}/tickets/{ticket.Id}",
                            "subtask");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi de notification du sous-ticket {TicketId} à {UserId}", ticket.Id, managerId);
                    }
                }
            }

            var result = MapToDto(ticket, hasSubTickets);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPost("{parentId}/subtickets")]
        public async Task<ActionResult<TicketDto>> CreateSubTicket(int parentId, [FromBody] CreateSubTicketDto dto)
        {
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(x => x.Value.Errors.Count > 0)
                    .ToDictionary(
                        kvp => kvp.Key,
                        kvp => kvp.Value.Errors.Select(e => e.ErrorMessage).ToArray()
                    );
                _logger.LogWarning("Validation échouée sur CreateSubTicket : {@Errors}", errors);
                return BadRequest(errors);
            }

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var parentTicket = await _db.Tickets.FindAsync(parentId);
            if (parentTicket == null) return NotFound();

            string? callerRole = null;
            if (parentTicket.ProjectId != null)
            {
                callerRole = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, parentTicket.ProjectId.Value);
                if (!User.IsInRole("Admin") && callerRole != "ScrumMaster")
                    return Forbid();
            }

            // Règle métier (Profondeur) : un sous-ticket ne peut pas avoir d'autre sous-ticket
            if (parentTicket.ParentTicketId != null)
                return BadRequest(new { message = "Un sous-ticket ne peut pas avoir d'autre sous-ticket." });

            if (dto.AssigneeId.HasValue)
            {
                var assignee = await _db.Users.FindAsync(dto.AssigneeId.Value);
                if (assignee == null)
                {
                    _logger.LogWarning("CreateSubTicket: AssigneeId invalide {AssigneeId}", dto.AssigneeId);
                    return BadRequest(new { AssigneeId = "Utilisateur (assignee) introuvable." });
                }
            }

            // Chaîne hiérarchique stricte : SM→Senior, Senior→Developer, Admin→libre.
            if (parentTicket.ProjectId != null)
            {
                var chainError = await ValidateAssigneeChainAsync(callerRole, parentTicket.ProjectId.Value, dto.AssigneeId);
                if (chainError != null)
                    return BadRequest(new { AssigneeId = chainError });
            }

            var ticket = new Ticket
            {
                Titre = dto.Titre,
                Description = dto.Description ?? string.Empty,
                // Sécurité : CreatorId extrait du token JWT, jamais du body
                CreatorId = userId.Value,
                AssigneeId = dto.AssigneeId,
                // Héritage : même projet et même sprint que le ticket parent
                ProjectId = parentTicket.ProjectId,
                SprintId = parentTicket.SprintId,
                ParentTicketId = parentId,
                Status = Domain.Entity.Status.A_FAIRE,
                Priority = Enum.TryParse<Domain.Entity.Priority>(dto.Priority ?? string.Empty, out var p) ? p : Domain.Entity.Priority.MOYENNE,
                DateCreation = DateTime.UtcNow,
                Color = string.IsNullOrEmpty(dto.Color) ? "#ffffff" : dto.Color
            };
            _db.Tickets.Add(ticket);
            await _db.SaveChangesAsync();

            var hasSubTickets = await _db.Tickets.AnyAsync(t => t.ParentTicketId == ticket.Id);

            // Notification du développeur affecté au sous-ticket
            if (ticket.AssigneeId.HasValue)
            {
                var assignee = await _db.Users.FindAsync(ticket.AssigneeId.Value);
                if (assignee != null)
                {
                    try
                    {
                        await _emailService.SendEmailAsync(
                            assignee.Email,
                            "Sous-ticket assigné",
                            $"Bonjour {assignee.Prenom} {assignee.Nom},\n\nLe sous-ticket « {ticket.Titre} » vous a été assigné.\n\nCordialement,\nL'équipe Jira");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi d'email pour l'assignation du sous-ticket {TicketId}", ticket.Id);
                    }

                    try
                    {
                        await _notificationService.SendNotificationAsync(
                            assignee.Id,
                            "Sous-ticket assigné",
                            $"Le sous-ticket « {ticket.Titre} » vous a été assigné.",
                            ticket.ProjectId.HasValue ? $"/projects/{ticket.ProjectId.Value}/tickets/{ticket.Id}" : $"/tickets/{ticket.Id}",
                            "subtask");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi de notification pour l'assignation du sous-ticket {TicketId}", ticket.Id);
                    }
                }
            }

            // Notification du Scrum Master / des Seniors à la création d'un sous-ticket
            if (ticket.ProjectId.HasValue)
            {
                var managerIds = await _db.ProjectMembers
                    .Where(pm => pm.ProjectId == ticket.ProjectId.Value
                        && (pm.RoleInProject == "ScrumMaster" || pm.RoleInProject == "Senior")
                        && pm.UserId != ticket.CreatorId)
                    .Select(pm => pm.UserId)
                    .ToListAsync();

                foreach (var managerId in managerIds)
                {
                    try
                    {
                        await _notificationService.SendNotificationAsync(
                            managerId,
                            "Nouveau sous-ticket",
                            $"Un sous-ticket « {ticket.Titre} » a été créé.",
                            $"/projects/{ticket.ProjectId.Value}/tickets/{ticket.Id}",
                            "subtask");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi de notification du sous-ticket {TicketId} à {UserId}", ticket.Id, managerId);
                    }
                }
            }

            var result = MapToDto(ticket, hasSubTickets);
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTicketDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var ticket = await _db.Tickets.FindAsync(id);
            if (ticket == null) return NotFound();

            string? callerRole = null;
            if (ticket.ProjectId != null)
            {
                callerRole = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, ticket.ProjectId.Value);
                if (!User.IsInRole("Admin") && callerRole != "ScrumMaster")
                    return Forbid();
            }

            // Chaîne hiérarchique stricte : SM→Senior, Senior→Developer, Admin→libre.
            if (ticket.ProjectId != null)
            {
                var chainError = await ValidateAssigneeChainAsync(callerRole, ticket.ProjectId.Value, dto.AssigneeId);
                if (chainError != null)
                    return BadRequest(new { AssigneeId = chainError });
            }

            ticket.Titre = dto.Titre;
            ticket.Description = dto.Description;
            ticket.CreatorId = dto.CreatorId;
            var previousAssigneeId = ticket.AssigneeId;
            ticket.AssigneeId = dto.AssigneeId;
            ticket.ProjectId = dto.ProjectId;
            if (!string.IsNullOrEmpty(dto.Status) && Enum.TryParse<Domain.Entity.Status>(dto.Status, out var s))
            {
                if (!IsValidTransition(ticket.Status.ToString(), dto.Status))
                    return BadRequest(new { error = "Transition de statut non autorisée." });
                ticket.Status = s;
            }
            if (!string.IsNullOrEmpty(dto.Priority) && Enum.TryParse<Domain.Entity.Priority>(dto.Priority, out var p)) ticket.Priority = p;
            ticket.Color = string.IsNullOrEmpty(dto.Color) ? ticket.Color : dto.Color;
            _db.Tickets.Update(ticket);
            await _db.SaveChangesAsync();

            // Notification du nouveau développeur affecté au ticket
            if (dto.AssigneeId.HasValue && dto.AssigneeId.Value != previousAssigneeId)
            {
                var assignee = await _db.Users.FindAsync(dto.AssigneeId.Value);
                if (assignee != null)
                {
                    try
                    {
                        await _emailService.SendEmailAsync(
                            assignee.Email,
                            "Ticket assigné",
                            $"Bonjour {assignee.Prenom} {assignee.Nom},\n\nLe ticket « {ticket.Titre} » vous a été assigné.\n\nCordialement,\nL'équipe Jira");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi d'email pour l'assignation du ticket {TicketId}", ticket.Id);
                    }

                    try
                    {
                        await _notificationService.SendNotificationAsync(
                            assignee.Id,
                            "Ticket assigné",
                            $"Le ticket « {ticket.Titre} » vous a été assigné.",
                            ticket.ProjectId.HasValue ? $"/projects/{ticket.ProjectId.Value}/tickets/{ticket.Id}" : $"/tickets/{ticket.Id}",
                            "ticket");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Échec de l'envoi de notification pour l'assignation du ticket {TicketId}", ticket.Id);
                    }
                }
            }

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var item = await _db.Tickets.FindAsync(id);
            if (item == null) return NotFound();

            // Suppression définitive : Admin global uniquement.
            if (!User.IsInRole("Admin"))
                return Forbid();

            // Charger la sous-arborescence complète du ticket (tous les niveaux)
            var ticketsToDelete = new List<Ticket> { item };
            var currentLevel = new List<Ticket> { item };
            while (currentLevel.Count > 0)
            {
                var levelIds = currentLevel.Select(t => t.Id).ToList();
                var children = await _db.Tickets
                    .Where(t => t.ParentTicketId != null && levelIds.Contains(t.ParentTicketId.Value))
                    .ToListAsync();
                ticketsToDelete.AddRange(children);
                currentLevel = children;
            }

            // Suppression feuille d'abord pour respecter la contrainte FK Restrict (self-referencing)
            var remaining = ticketsToDelete;
            while (remaining.Count > 0)
            {
                var remainingIds = remaining.Select(t => t.Id).ToHashSet();
                var referencedParentIds = remaining
                    .Where(t => t.ParentTicketId.HasValue && remainingIds.Contains(t.ParentTicketId.Value))
                    .Select(t => t.ParentTicketId!.Value)
                    .ToHashSet();

                var leaves = remaining.Where(t => !referencedParentIds.Contains(t.Id)).ToList();
                if (leaves.Count == 0) break;

                _db.Tickets.RemoveRange(leaves);
                await _db.SaveChangesAsync();
                remaining = remaining.Where(t => !leaves.Contains(t)).ToList();
            }

            return NoContent();
        }

        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] JsonElement payload)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var ticket = await _db.Tickets.FindAsync(id);
            if (ticket == null) return NotFound();

            if (ticket.ProjectId != null)
            {
                var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, ticket.ProjectId.Value);
                // Gestionnaires du projet (ScrumMaster / Senior) ou Admin global.
                var isManager = role == "ScrumMaster" || role == "Senior" || User.IsInRole("Admin");
                // Un Developer ne peut déplacer que les tickets qui lui sont assignés.
                var isDeveloperAssignee = role == "Developer" && ticket.AssigneeId == userId.Value;

                if (!isManager && !isDeveloperAssignee)
                    return Forbid();
            }

            string? statusStr = null;

            if (payload.ValueKind == JsonValueKind.String)
            {
                statusStr = payload.GetString();
            }
            else if (payload.ValueKind == JsonValueKind.Object)
            {
                if (payload.TryGetProperty("status", out var prop) && prop.ValueKind == JsonValueKind.String)
                {
                    statusStr = prop.GetString();
                }
            }

            if (string.IsNullOrEmpty(statusStr)) return BadRequest(new { error = "Status manquant ou invalide." });

            if (!Enum.TryParse<Domain.Entity.Status>(statusStr, out var newStatus))
            {
                return BadRequest(new { error = "Status inconnu." });
            }

            if (!IsValidTransition(ticket.Status.ToString(), statusStr))
            {
                return BadRequest(new { error = "Transition de statut non autorisée." });
            }

            ticket.Status = newStatus;
            _db.Tickets.Update(ticket);
            await _db.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>
        /// Modifie UNIQUEMENT l'assignation d'un ticket (ScrumMaster, Senior ou Admin).
        /// Un Senior peut donc assigner un Developer à un ticket sans pouvoir en modifier le contenu.
        /// </summary>
        [HttpPatch("{id}/assignee")]
        public async Task<IActionResult> UpdateAssignee(int id, [FromBody] JsonElement payload)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var ticket = await _db.Tickets.FindAsync(id);
            if (ticket == null) return NotFound();

            string? callerRole = null;
            if (ticket.ProjectId != null)
            {
                callerRole = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, ticket.ProjectId.Value);
                if (!User.IsInRole("Admin") && callerRole != "ScrumMaster" && callerRole != "Senior")
                    return Forbid();
            }

            int? newAssigneeId = null;
            if (payload.ValueKind == JsonValueKind.Object &&
                payload.TryGetProperty("assigneeId", out var prop))
            {
                if (prop.ValueKind == JsonValueKind.Number)
                {
                    newAssigneeId = prop.GetInt32();
                }
                else if (prop.ValueKind == JsonValueKind.String &&
                         int.TryParse(prop.GetString(), out var parsed))
                {
                    newAssigneeId = parsed;
                }
                // Null ou non renseigné → désassignation.
            }

            var previousAssigneeId = ticket.AssigneeId;
            if (newAssigneeId == previousAssigneeId)
                return NoContent();

            // Chaîne hiérarchique stricte : SM→Senior, Senior→Developer, Admin→libre.
            if (ticket.ProjectId != null)
            {
                var chainError = await ValidateAssigneeChainAsync(callerRole, ticket.ProjectId.Value, newAssigneeId);
                if (chainError != null)
                    return BadRequest(new { assigneeId = chainError });
            }

            if (newAssigneeId.HasValue)
            {
                var assignee = await _db.Users.FindAsync(newAssigneeId.Value);
                if (assignee == null)
                    return BadRequest(new { assigneeId = "Utilisateur (assignee) introuvable." });
            }

            ticket.AssigneeId = newAssigneeId;
            _db.Tickets.Update(ticket);
            await _db.SaveChangesAsync();

            await NotifyAssigneeAsync(ticket, newAssigneeId, previousAssigneeId);

            return NoContent();
        }

        private async Task NotifyAssigneeAsync(Ticket ticket, int? newAssigneeId, int? previousAssigneeId)
        {
            if (!newAssigneeId.HasValue || newAssigneeId.Value == previousAssigneeId) return;

            var assignee = await _db.Users.FindAsync(newAssigneeId.Value);
            if (assignee == null) return;

            try
            {
                await _emailService.SendEmailAsync(
                    assignee.Email,
                    "Ticket assigné",
                    $"Bonjour {assignee.Prenom} {assignee.Nom},\n\nLe ticket « {ticket.Titre} » vous a été assigné.\n\nCordialement,\nL'équipe Jira");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Échec de l'envoi d'email pour l'assignation du ticket {TicketId}", ticket.Id);
            }

            try
            {
                await _notificationService.SendNotificationAsync(
                    assignee.Id,
                    "Ticket assigné",
                    $"Le ticket « {ticket.Titre} » vous a été assigné.",
                    ticket.ProjectId.HasValue ? $"/projects/{ticket.ProjectId.Value}/tickets/{ticket.Id}" : $"/tickets/{ticket.Id}",
                    "ticket");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Échec de l'envoi de notification pour l'assignation du ticket {TicketId}", ticket.Id);
            }
        }

        /// <summary>
        /// Chaîne d'assignation stricte : ScrumMaster → Senior uniquement, Senior → Developer uniquement.
        /// Admin global : bypass complet (peut assigner n'importe qui).
        /// Désassignation (assigneeId null) : jamais bloquée.
        /// Retourne null si l'assignation est autorisée, sinon un message d'erreur.
        /// </summary>
        private async Task<string?> ValidateAssigneeChainAsync(string? callerRole, int projectId, int? assigneeId)
        {
            if (!assigneeId.HasValue) return null;                       // Désassignation : toujours autorisée.
            if (User.IsInRole("Admin")) return null;                     // Admin : bypass complet de la chaîne.
            if (callerRole == null) return "Vous n'avez pas le droit d'assigner un ticket sur ce projet.";

            var expectedRole = callerRole switch
            {
                "ScrumMaster" => "Senior",
                "Senior" => "Developer",
                _ => null
            };

            if (expectedRole == null)
                return "Votre rôle ne vous permet pas d'assigner un ticket.";

            var assigneeRole = await _projectAuthService.GetUserRoleInProjectAsync(assigneeId.Value, projectId);
            if (assigneeRole == null)
                return "Cet utilisateur n'est pas membre de ce projet.";

            if (!string.Equals(assigneeRole, expectedRole, StringComparison.OrdinalIgnoreCase))
                return $"Un {callerRole} ne peut assigner qu'un {expectedRole}.";

            return null;
        }

        [HttpGet("{id}/subtickets")]
        public async Task<ActionResult<IEnumerable<TicketDto>>> GetSubTickets(int id)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var parent = await _db.Tickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id);
            if (parent == null) return NotFound();

            if (parent.ProjectId != null)
            {
                var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, parent.ProjectId.Value);
                if (role == null && !User.IsInRole("Admin"))
                    return Forbid();

                // Un Developer ne voit que ses propres sous-tickets.
                if (role == "Developer" && parent.AssigneeId != userId.Value)
                    return Forbid();
            }

            var subTickets = await _db.Tickets
                .AsNoTracking()
                .Where(t => t.ParentTicketId == id)
                .Where(t => !User.IsInRole("Developer") || t.AssigneeId == userId.Value)
                .ToListAsync();

            var parentIds = subTickets
                .Select(t => t.Id)
                .ToHashSet();

            var deeperParentIds = await _db.Tickets
                .Where(t => t.ParentTicketId != null && parentIds.Contains(t.ParentTicketId.Value))
                .Select(t => t.ParentTicketId)
                .Distinct()
                .ToListAsync();

            var deeperSet = deeperParentIds.ToHashSet();

            var dtos = subTickets.Select(t => MapToDto(t, deeperSet.Contains(t.Id)));

            return Ok(dtos);
        }

        private static bool IsValidTransition(string from, string to)
        {
            return (from, to) switch
            {
                ("A_FAIRE", "EN_COURS") => true,
                ("EN_COURS", "TERMINE") => true,
                _ => false
            };
        }
    }
}
