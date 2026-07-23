using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

        public TicketsController(ApplicationDbContext db)
        {
            _db = db;
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
                DateResolution = t.DateResolution
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
                DateResolution = item.DateResolution
            };
            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<TicketDto>> Create([FromBody] CreateTicketDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var ticket = new Ticket
            {
                Titre = dto.Titre,
                Description = dto.Description,
                CreatorId = dto.CreatorId,
                AssigneeId = dto.AssigneeId,
                ProjectId = dto.ProjectId,
                Status = Enum.TryParse<Domain.Entity.Status>(dto.Status ?? string.Empty, out var s) ? s : Domain.Entity.Status.A_FAIRE,
                Priority = Enum.TryParse<Domain.Entity.Priority>(dto.Priority ?? string.Empty, out var p) ? p : Domain.Entity.Priority.MOYENNE,
                DateCreation = DateTime.UtcNow
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
                DateResolution = ticket.DateResolution
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
    }
}
