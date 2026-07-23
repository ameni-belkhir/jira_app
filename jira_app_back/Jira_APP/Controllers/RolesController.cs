using System.Collections.Generic;
using System.Threading.Tasks;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Domain.Entity;
using Application.DTO;
using System.Linq;

using Microsoft.AspNetCore.Authorization;
namespace Jira_APP.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class RolesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public RolesController(ApplicationDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<RoleDto>>> Get()
        {
            var items = await _db.Roles.AsNoTracking().ToListAsync();
            var dtos = items.Select(r => new RoleDto { Id = r.Id, Description = r.Description });
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<RoleDto>> GetById(int id)
        {
            var item = await _db.Roles.FindAsync(id);
            if (item == null) return NotFound();
            return Ok(new RoleDto { Id = item.Id, Description = item.Description });
        }

        [HttpPost]
        public async Task<ActionResult<RoleDto>> Create([FromBody] CreateRoleDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var role = new Role { Description = dto.Description };
            _db.Roles.Add(role);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(GetById), new { id = role.Id }, new RoleDto { Id = role.Id, Description = role.Description });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateRoleDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();
            var role = await _db.Roles.FindAsync(id);
            if (role == null) return NotFound();
            role.Description = dto.Description;
            _db.Roles.Update(role);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Roles.FindAsync(id);
            if (item == null) return NotFound();
            _db.Roles.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
