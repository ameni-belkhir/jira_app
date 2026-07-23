using System.Collections.Generic;
using System.Threading.Tasks;
using Application.DTO;

namespace Application.Interfaces
{
    public interface IConversationService
    {
        Task<ConversationDto?> GetByIdAsync(int id);
        Task<IEnumerable<ConversationDto>> GetAllAsync();
        Task<ConversationDto> CreateAsync(ConversationDto dto);
        Task<bool> UpdateAsync(ConversationDto dto);
        Task<bool> DeleteAsync(int id);
    }
}
