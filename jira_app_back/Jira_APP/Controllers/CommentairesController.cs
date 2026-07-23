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
    public class CommentairesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public CommentairesController(ApplicationDbContext db)
        {
            _db = db;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<CommentaireDto>>> Get()
        {
            var items = await _db.Commentaires.AsNoTracking().ToListAsync();
            var dtos = items.Select(c => new CommentaireDto
            {
                Id = c.Id,
                Contenu = c.Contenu,
                AuthorId = c.AuthorId,
                TicketId = c.TicketId,
                DateCreation = c.DateCreation
            });
            return Ok(dtos);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CommentaireDto>> GetById(int id)
        {
            var item = await _db.Commentaires.FindAsync(id);
            if (item == null) return NotFound();
            var dto = new CommentaireDto
            {
                Id = item.Id,
                Contenu = item.Contenu,
                AuthorId = item.AuthorId,
                TicketId = item.TicketId,
                DateCreation = item.DateCreation
            };
            return Ok(dto);
        }

        [HttpPost]
        public async Task<ActionResult<CommentaireDto>> Create([FromBody] CreateCommentaireDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var commentaire = new Commentaire
            {
                Contenu = dto.Contenu,
                AuthorId = dto.AuthorId,
                TicketId = dto.TicketId,
                DateCreation = DateTime.UtcNow
            };
            _db.Commentaires.Add(commentaire);
            await _db.SaveChangesAsync();
            var result = new CommentaireDto
            {
                Id = commentaire.Id,
                Contenu = commentaire.Contenu,
                AuthorId = commentaire.AuthorId,
                TicketId = commentaire.TicketId,
                DateCreation = commentaire.DateCreation
            };
            return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateCommentaireDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (id != dto.Id) return BadRequest();
            var comment = await _db.Commentaires.FindAsync(id);
            if (comment == null) return NotFound();
            comment.Contenu = dto.Contenu;
            comment.AuthorId = dto.AuthorId;
            comment.TicketId = dto.TicketId;
            _db.Commentaires.Update(comment);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _db.Commentaires.FindAsync(id);
            if (item == null) return NotFound();
            _db.Commentaires.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }
    }
}
