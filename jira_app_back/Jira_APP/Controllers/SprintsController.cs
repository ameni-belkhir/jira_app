using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api")]
    public class SprintsController : ControllerBase
    {
        private readonly ISprintService _sprintService;

        public SprintsController(ISprintService sprintService)
        {
            _sprintService = sprintService;
        }

        [HttpGet("projects/{projectId}/sprints")]
        public async Task<ActionResult<IEnumerable<SprintDto>>> GetSprints(int projectId)
        {
            var items = await _sprintService.GetByProjectIdAsync(projectId);
            return Ok(items);
        }

        [HttpGet("projects/{projectId}/backlog")]
        public async Task<ActionResult<ProjectBacklogDto>> GetProjectBacklog(int projectId)
        {
            var backlog = await _sprintService.GetProjectBacklogAsync(projectId);
            return Ok(backlog);
        }

        [HttpPost("sprints")]
        public async Task<ActionResult<SprintDto>> Create([FromBody] CreateSprintDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var result = await _sprintService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetSprints), new { projectId = result.ProjectId }, result);
        }

        [HttpPut("sprints/{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateSprintDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();
            var ok = await _sprintService.UpdateAsync(dto);
            if (!ok) return NotFound();
            return NoContent();
        }

        [HttpPut("tickets/{ticketId}/move-to-sprint")]
        public async Task<IActionResult> MoveTicketToSprint(int ticketId, [FromBody] MoveTicketToSprintDto dto)
        {
            if (ticketId != dto.TicketId) return BadRequest();
            var ok = await _sprintService.MoveTicketToSprintAsync(dto.TicketId, dto.SprintId);
            if (!ok) return NotFound();
            return NoContent();
        }
    }
}
