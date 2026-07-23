using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO;

namespace Application.Interfaces
{
    public interface IMessageService
    {
        Task<MessageDto?> GetByIdAsync(int id);
        Task<IEnumerable<MessageDto>> GetByConversationIdAsync(int conversationId);
        Task<MessageDto> CreateAsync(MessageDto dto);
        Task<bool> UpdateAsync(MessageDto dto);
        Task<bool> DeleteAsync(int id);
    }
}
