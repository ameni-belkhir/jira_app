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
using Jira_APP.Auth;
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
        private readonly IEmailService _emailService;
        private readonly INotificationService _notificationService;
        private readonly ILogger<TicketsController> _logger;

        public TicketsController(
            ApplicationDbContext db,
            IEmailService emailService,
            INotificationService notificationService,
            ILogger<TicketsController> logger)
        {
            _db = db;
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

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TicketDto>>> Get()
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var userProjectIds = await _db.ProjectMembers
                .Where(pm => pm.UserId == userId.Value)
                .Select(pm => pm.ProjectId)
                .ToListAsync();

            var items = await _db.Tickets
                .AsNoTracking()
                .Where(t => t.ProjectId == null || userProjectIds.Contains(t.ProjectId.Value))
                .ToListAsync();

            var parentIds = await _db.Tickets
                .Where(t => t.ParentTicketId != null && items.Select(i => i.Id).Contains(t.ParentTicketId.Value))
                .Select(t => t.ParentTicketId)
                .Distinct()
                .ToListAsync();

            var parentIdsSet = parentIds.ToHashSet();

            var dtos = items.Select(t => new TicketDto
            {
                Id = t.Id,
                Titre = t.Titre,
                Description = t.Description,
                CreatorId = t.CreatorId,
                AssigneeId = t.AssigneeId,
                ProjectId = t.ProjectId,
                SprintId = t.SprintId,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                DateCreation = t.DateCreation,
                DateResolution = t.DateResolution,
                Color = t.Color ?? "#ffffff",
                HasSubTickets = parentIdsSet.Contains(t.Id)
            });
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
                var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId.Value, item.ProjectId.Value);
                if (role == null)
                    return Forbid();
            }

            var hasSubTickets = await _db.Tickets.AnyAsync(t => t.ParentTicketId == id);

            var dto = new TicketDto
            {
                Id = item.Id,
                Titre = item.Titre,
                Description = item.Description,
                CreatorId = item.CreatorId,
                AssigneeId = item.AssigneeId,
                ProjectId = item.ProjectId,
                SprintId = item.SprintId,
                Status = item.Status.ToString(),
                Priority = item.Priority.ToString(),
                DateCreation = item.DateCreation,
                DateResolution = item.DateResolution,
                Color = item.Color ?? "#ffffff",
                HasSubTickets = hasSubTickets
            };
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

            if (dto.ProjectId.HasValue)
            {
                var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId.Value, dto.ProjectId.Value);
                if (role != "ScrumMaster" && role != "Senior")
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

            var result = new TicketDto
            {
                Id = ticket.Id,
                Titre = ticket.Titre,
                Description = ticket.Description,
                CreatorId = ticket.CreatorId,
                AssigneeId = ticket.AssigneeId,
                ProjectId = ticket.ProjectId,
                SprintId = ticket.SprintId,
                Status = ticket.Status.ToString(),
                Priority = ticket.Priority.ToString(),
                DateCreation = ticket.DateCreation,
                DateResolution = ticket.DateResolution,
                Color = ticket.Color ?? "#ffffff",
                HasSubTickets = hasSubTickets
            };
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

            if (ticket.ProjectId != null)
            {
                var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId.Value, ticket.ProjectId.Value);
                if (role != "ScrumMaster" && role != "Senior")
                    return Forbid();
            }

            ticket.Titre = dto.Titre;
            ticket.Description = dto.Description;
            ticket.CreatorId = dto.CreatorId;
            var previousAssigneeId = ticket.AssigneeId;
            ticket.AssigneeId = dto.AssigneeId;
            ticket.ProjectId = dto.ProjectId;
            if (!string.IsNullOrEmpty(dto.Status) && Enum.TryParse<Domain.Entity.Status>(dto.Status, out var s)) ticket.Status = s;
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

            if (item.ProjectId != null)
            {
                var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId.Value, item.ProjectId.Value);
                if (role != "ScrumMaster" && role != "Senior")
                    return Forbid();
            }

            _db.Tickets.Remove(item);
            await _db.SaveChangesAsync();
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
                var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId.Value, ticket.ProjectId.Value);
                var isScrumMasterOrSenior = role == "ScrumMaster" || role == "Senior";
                var isDeveloperInSprint = false;

                if (role == "Developer" && ticket.SprintId != null)
                {
                    isDeveloperInSprint = await _db.SprintMembers
                        .AnyAsync(sm => sm.SprintId == ticket.SprintId.Value && sm.UserId == userId.Value);
                }

                if (!isScrumMasterOrSenior && !isDeveloperInSprint)
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

            ticket.Status = newStatus;
            _db.Tickets.Update(ticket);
            await _db.SaveChangesAsync();

            return NoContent();
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
                var role = await ProjectAuthorizationHelper.GetUserRoleInProjectAsync(_db, userId.Value, parent.ProjectId.Value);
                if (role == null)
                    return Forbid();
            }

            var subTickets = await _db.Tickets
                .AsNoTracking()
                .Where(t => t.ParentTicketId == id)
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

            var dtos = subTickets.Select(t => new TicketDto
            {
                Id = t.Id,
                Titre = t.Titre,
                Description = t.Description,
                CreatorId = t.CreatorId,
                AssigneeId = t.AssigneeId,
                ProjectId = t.ProjectId,
                SprintId = t.SprintId,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                DateCreation = t.DateCreation,
                DateResolution = t.DateResolution,
                Color = t.Color ?? "#ffffff",
                HasSubTickets = deeperSet.Contains(t.Id)
            });

            return Ok(dtos);
        }
    }
}
