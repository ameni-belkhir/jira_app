using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.DTO;
using Application.Interfaces;
using Domain.Entity;
using Domain.Interfaces;

namespace Application.Services
{
    public class MessageService : IMessageService
    {
        private readonly IMessageRepository _messageRepository;

        public MessageService(IMessageRepository messageRepository)
        {
            _messageRepository = messageRepository;
        }

        public async Task<MessageDto?> GetByIdAsync(int id)
        {
            var m = await _messageRepository.GetByIdAsync(id);
            if (m == null) return null;
            return MapToDto(m);
        }

        public async Task<IEnumerable<MessageDto>> GetByConversationIdAsync(int conversationId)
        {
            var items = await _messageRepository.GetByConversationIdAsync(conversationId);
            return items.Select(MapToDto);
        }

        public async Task<MessageDto> CreateAsync(MessageDto dto)
        {
            var entity = new Message
            {
                SenderId = dto.SenderId,
                Contenu = dto.Contenu,
                ConversationId = dto.ConversationId,
                Lu = dto.Lu
            };
            await _messageRepository.AddAsync(entity);
            await _messageRepository.SaveChangesAsync();
            dto.Id = entity.Id;
            return dto;
        }

        public async Task<bool> UpdateAsync(MessageDto dto)
        {
            var entity = await _messageRepository.GetByIdAsync(dto.Id);
            if (entity == null) return false;
            entity.Contenu = dto.Contenu;
            entity.Lu = dto.Lu;
            _messageRepository.Update(entity);
            return await _messageRepository.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var entity = await _messageRepository.GetByIdAsync(id);
            if (entity == null) return false;
            _messageRepository.Delete(entity);
            return await _messageRepository.SaveChangesAsync();
        }

        private static MessageDto MapToDto(Message m) => new MessageDto
        {
            Id = m.Id,
            SenderId = m.SenderId,
            Contenu = m.Contenu,
            DateCreation = m.DateCreation,
            Lu = m.Lu,
            ConversationId = m.ConversationId
        };
    }
}
