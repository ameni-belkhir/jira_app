using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Domain.Entity;
using Application.DTO;

using Microsoft.AspNetCore.Authorization;
namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class TicketsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly Microsoft.Extensions.Logging.ILogger<TicketsController> _logger;

        public TicketsController(ApplicationDbContext db, Microsoft.Extensions.Logging.ILogger<TicketsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TicketDto>>> Get()
        {
            var items = await _db.Tickets.AsNoTracking().ToListAsync();
            var dtos = items.Select(t => new TicketDto
            {
                Id = t.Id,
                Titre = t.Titre,
                Description = t.Description,
                CreatorId = t.CreatorId,
                AssigneeId = t.AssigneeId,
                ProjectId = t.ProjectId,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                DateCreation = t.DateCreation,
                DateResolution = t.DateResolution,
                Color = t.Color ?? "#ffffff"
            });
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TicketDto>> GetById(int id)
        {
            var item = await _db.Tickets.FindAsync(id);
            if (item == null) return NotFound();
            var dto = new TicketDto
            {
                Id = item.Id,
                Titre = item.Titre,
                Description = item.Description,
                CreatorId = item.CreatorId,
                AssigneeId = item.AssigneeId,
                ProjectId = item.ProjectId,
                Status = item.Status.ToString(),
                Priority = item.Priority.ToString(),
                DateCreation = item.DateCreation,
                DateResolution = item.DateResolution,
                Color = item.Color ?? "#ffffff"
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

            // Vérifier que le reporter (Creator) existe
            var creator = await _db.Users.FindAsync(dto.CreatorId);
            if (creator == null)
            {
                _logger.LogWarning("CreateTicket: CreatorId invalide {CreatorId}", dto.CreatorId);
                return BadRequest(new { CreatorId = "Utilisateur (creator) introuvable." });
            }

            // Si ProjectId fourni, vérifier existence
            if (dto.ProjectId.HasValue)
            {
                var project = await _db.Projects.FindAsync(dto.ProjectId.Value);
                if (project == null)
                {
                    _logger.LogWarning("CreateTicket: ProjectId invalide {ProjectId}", dto.ProjectId);
                    return BadRequest(new { ProjectId = "Projet introuvable." });
                }
            }

            // Si AssigneeId fourni, vérifier existence
            if (dto.AssigneeId.HasValue)
            {
                var assignee = await _db.Users.FindAsync(dto.AssigneeId.Value);
                if (assignee == null)
                {
                    _logger.LogWarning("CreateTicket: AssigneeId invalide {AssigneeId}", dto.AssigneeId);
                    return BadRequest(new { AssigneeId = "Utilisateur (assignee) introuvable." });
                }
            }
            var ticket = new Ticket
            {
                Titre = dto.Titre,
                Description = dto.Description,
                CreatorId = dto.CreatorId,
                AssigneeId = dto.AssigneeId,
                ProjectId = dto.ProjectId,
                Status = Enum.TryParse<Domain.Entity.Status>(dto.Status ?? string.Empty, out var s) ? s : Domain.Entity.Status.A_FAIRE,
                Priority = Enum.TryParse<Domain.Entity.Priority>(dto.Priority ?? string.Empty, out var p) ? p : Domain.Entity.Priority.MOYENNE,
                DateCreation = DateTime.UtcNow,
                Color = string.IsNullOrEmpty(dto.Color) ? "#ffffff" : dto.Color
            };
            _db.Tickets.Add(ticket);
            await _db.SaveChangesAsync();
            var result = new TicketDto
            {
                Id = ticket.Id,
                Titre = ticket.Titre,
                Description = ticket.Description,
                CreatorId = ticket.CreatorId,
                AssigneeId = ticket.AssigneeId,
                ProjectId = ticket.ProjectId,
                Status = ticket.Status.ToString(),
                Priority = ticket.Priority.ToString(),
                DateCreation = ticket.DateCreation,
                DateResolution = ticket.DateResolution,
                Color = ticket.Color ?? "#ffffff"
            };
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTicketDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();
            var ticket = await _db.Tickets.FindAsync(id);
            if (ticket == null) return NotFound();
            ticket.Titre = dto.Titre;
            ticket.Description = dto.Description;
            ticket.CreatorId = dto.CreatorId;
            ticket.AssigneeId = dto.AssigneeId;
            ticket.ProjectId = dto.ProjectId;
            if (!string.IsNullOrEmpty(dto.Status) && Enum.TryParse<Domain.Entity.Status>(dto.Status, out var s)) ticket.Status = s;
            if (!string.IsNullOrEmpty(dto.Priority) && Enum.TryParse<Domain.Entity.Priority>(dto.Priority, out var p)) ticket.Priority = p;
            ticket.Color = string.IsNullOrEmpty(dto.Color) ? ticket.Color : dto.Color;
            _db.Tickets.Update(ticket);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Tickets.FindAsync(id);
            if (item == null) return NotFound();
            _db.Tickets.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // Endpoint pour mise à jour rapide du status (Drag & Drop)
        // Accepts body as either a raw string ("A_FAIRE") or an object { "status": "A_FAIRE" }
        [HttpPatch("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] JsonElement payload)
        {
            var ticket = await _db.Tickets.FindAsync(id);
            if (ticket == null) return NotFound();

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
    }
}
