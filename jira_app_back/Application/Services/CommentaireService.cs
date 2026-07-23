using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class CommentaireService : ICommentaireService
    {
        private readonly ICommentaireRepository _commentaireRepository;

        public CommentaireService(ICommentaireRepository commentaireRepository)
        {
            _commentaireRepository = commentaireRepository;
        }

        public async Task<CommentaireDto?> GetByIdAsync(int id)
        {
            var c = await _commentaireRepository.GetByIdAsync(id);
            if (c == null) return null;
            return MapToDto(c);
        }

        public async Task<IEnumerable<CommentaireDto>> GetByTicketIdAsync(int ticketId)
        {
            var items = await _commentaireRepository.GetByTicketIdAsync(ticketId);
            return items.Select(MapToDto);
        }

        public async Task<CommentaireDto> CreateAsync(CommentaireDto dto)
        {
            var entity = new Commentaire
            {
                Contenu = dto.Contenu,
                AuthorId = dto.AuthorId,
                TicketId = dto.TicketId
            };
            await _commentaireRepository.AddAsync(entity);
            await _commentaireRepository.SaveChangesAsync();
            dto.Id = entity.Id;
            return dto;
        }

        public async Task<bool> UpdateAsync(CommentaireDto dto)
        {
            var entity = await _commentaireRepository.GetByIdAsync(dto.Id);
            if (entity == null) return false;
            entity.Contenu = dto.Contenu;
            _commentaireRepository.Update(entity);
            return await _commentaireRepository.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var entity = await _commentaireRepository.GetByIdAsync(id);
            if (entity == null) return false;
            _commentaireRepository.Delete(entity);
            return await _commentaireRepository.SaveChangesAsync();
        }

        private static CommentaireDto MapToDto(Commentaire c) => new CommentaireDto
        {
            Id = c.Id,
            Contenu = c.Contenu,
            AuthorId = c.AuthorId,
            TicketId = c.TicketId,
            DateCreation = c.DateCreation
        };
    }
}
