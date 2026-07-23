using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using Application.Interfaces;
using Application.DTO;

namespace Presentation.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TicketController : ControllerBase
    {
        private readonly ITicketService _ticketService;

        public TicketController(ITicketService ticketService)
        {
            _ticketService = ticketService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<TicketDto>>> Get()
        {
            var items = await _ticketService.GetAllAsync();
            return Ok(items);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TicketDto>> GetById(int id)
        {
            var item = await _ticketService.GetByIdAsync(id);
            if (item == null) return NotFound();
            return Ok(item);
        }

        [HttpGet("project/{projectId}")]
        public async Task<ActionResult<IEnumerable<TicketDto>>> GetByProject(int projectId)
        {
            var items = await _ticketService.GetByProjectIdAsync(projectId);
            return Ok(items);
        }

        [HttpPost]
        public async Task<ActionResult<TicketDto>> Create([FromBody] TicketDto dto)
        {
            var created = await _ticketService.CreateAsync(dto);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] TicketDto dto)
        {
            if (id != dto.Id) return BadRequest();
            var ok = await _ticketService.UpdateAsync(dto);
            if (!ok) return NotFound();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _ticketService.DeleteAsync(id);
            if (!ok) return NotFound();
            return NoContent();
        }
    }
}
