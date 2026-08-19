using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api")]
    public class SprintsController : ControllerBase
    {
        private readonly ISprintService _sprintService;
        private readonly IProjectAuthorizationService _projectAuthService;
        private readonly ApplicationDbContext _db;

        public SprintsController(ISprintService sprintService, IProjectAuthorizationService projectAuthService, ApplicationDbContext db)
        {
            _sprintService = sprintService;
            _projectAuthService = projectAuthService;
            _db = db;
        }

        private async Task<int?> GetUserIdAsync()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(claim) || !int.TryParse(claim, out var id))
                return null;
            return id;
        }

        [HttpGet("projects/{projectId}/sprints")]
        public async Task<ActionResult<IEnumerable<SprintDto>>> GetSprints(int projectId)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, projectId);
            if (role == null && !User.IsInRole("Admin"))
                return Forbid();

            var items = await _sprintService.GetByProjectIdAsync(projectId);
            return Ok(items);
        }

        [HttpGet("projects/{projectId}/backlog")]
        public async Task<ActionResult<ProjectBacklogDto>> GetProjectBacklog(int projectId)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, projectId);
            if (role == null && !User.IsInRole("Admin"))
                return Forbid();

            var backlog = await _sprintService.GetProjectBacklogAsync(projectId, userId.Value, role);
            return Ok(backlog);
        }

        [HttpPost("sprints")]
        public async Task<ActionResult<SprintDto>> Create([FromBody] CreateSprintDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, dto.ProjectId);
            if (!User.IsInRole("Admin") && role != "ScrumMaster")
                return Forbid();

            var result = await _sprintService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetSprints), new { projectId = result.ProjectId }, result);
        }

        [HttpPut("sprints/{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateSprintDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();

            var sprint = await _db.Sprints.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            if (sprint == null) return NotFound();

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, sprint.ProjectId);
            if (!User.IsInRole("Admin") && role != "ScrumMaster")
                return Forbid();

            var ok = await _sprintService.UpdateAsync(dto);
            if (!ok) return NotFound();
            return NoContent();
        }

        [HttpDelete("sprints/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var sprint = await _db.Sprints.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id);
            if (sprint == null) return NotFound();

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, sprint.ProjectId);
            if (!User.IsInRole("Admin") && role != "ScrumMaster")
                return Forbid();

            var ok = await _sprintService.DeleteAsync(id);
            if (!ok) return NotFound();
            return NoContent();
        }

        [HttpGet("sprints/{sprintId}/tickets")]
        public async Task<ActionResult<IEnumerable<SprintTicketDto>>> GetTicketsBySprint(int sprintId)
        {
            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            var sprint = await _db.Sprints.AsNoTracking().FirstOrDefaultAsync(s => s.Id == sprintId);
            if (sprint == null) return NotFound();

            // ProjectId on Sprint is non-nullable; check authorization directly
            var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, sprint.ProjectId);
            if (role == null && !User.IsInRole("Admin"))
                return Forbid();

            var tickets = await _sprintService.GetTicketsBySprintAsync(sprintId, userId.Value, role);
            return Ok(tickets);
        }

        [HttpPut("tickets/{ticketId}/move-to-sprint")]
        public async Task<IActionResult> MoveTicketToSprint(int ticketId, [FromBody] MoveTicketToSprintDto dto)
        {
            if (ticketId != dto.TicketId) return BadRequest();

            var ticket = await _db.Tickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == ticketId);
            if (ticket == null) return NotFound();

            var userId = await GetUserIdAsync();
            if (userId == null) return Unauthorized();

            if (ticket.ProjectId == null)
                return BadRequest(new { message = "Ce ticket n'est associé à aucun projet." });

            var role = await _projectAuthService.GetUserRoleInProjectAsync(userId.Value, ticket.ProjectId.Value);
            if (!User.IsInRole("Admin") && role != "ScrumMaster")
                return Forbid();

            // Règle métier : blocage du déplacement si échéance dans ≤ 30 minutes
            if (ticket.DateEcheance.HasValue)
            {
                var utcNow = DateTime.UtcNow;
                var threshold = ticket.DateEcheance.Value.AddMinutes(-30);
                if (utcNow >= threshold)
                {
                    return Conflict(new { message = "Ce ticket ne peut plus être déplacé car sa date d'échéance est dans moins de 30 minutes ou est déjà dépassée." });
                }
            }

            var ok = await _sprintService.MoveTicketToSprintAsync(dto.TicketId, dto.SprintId);
            if (!ok) return NotFound();
            return NoContent();
        }
    }
}
