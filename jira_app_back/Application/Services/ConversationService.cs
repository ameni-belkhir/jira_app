using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class ConversationService : IConversationService
    {
        private readonly IConversationRepository _conversationRepository;

        public ConversationService(IConversationRepository conversationRepository)
        {
            _conversationRepository = conversationRepository;
        }

        public async Task<ConversationDto?> GetByIdAsync(int id)
        {
            var c = await _conversationRepository.GetByIdAsync(id);
            if (c == null) return null;
            return MapToDto(c);
        }

        public async Task<IEnumerable<ConversationDto>> GetAllAsync()
        {
            var items = await _conversationRepository.GetAllAsync();
            return items.Select(MapToDto);
        }

        public async Task<ConversationDto> CreateAsync(ConversationDto dto)
        {
            var entity = new Conversation
            {
                Titre = dto.Titre,
                TicketId = dto.TicketId
            };
            await _conversationRepository.AddAsync(entity);
            await _conversationRepository.SaveChangesAsync();
            dto.Id = entity.Id;
            return dto;
        }

        public async Task<bool> UpdateAsync(ConversationDto dto)
        {
            var entity = await _conversationRepository.GetByIdAsync(dto.Id);
            if (entity == null) return false;
            entity.Titre = dto.Titre;
            _conversationRepository.Update(entity);
            return await _conversationRepository.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var entity = await _conversationRepository.GetByIdAsync(id);
            if (entity == null) return false;
            _conversationRepository.Delete(entity);
            return await _conversationRepository.SaveChangesAsync();
        }

        private static ConversationDto MapToDto(Conversation c) => new ConversationDto
        {
            Id = c.Id,
            Titre = c.Titre,
            DateCreation = c.DateCreation,
            TicketId = c.TicketId,
            MessageIds = c.Messages.Select(m => m.Id).ToList()
        };
    }
}
