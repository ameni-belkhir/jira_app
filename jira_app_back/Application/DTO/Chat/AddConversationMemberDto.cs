using System.ComponentModel.DataAnnotations;

namespace Application.DTO.Chat
{
    public class AddConversationMemberDto
    {
        [Required]
        public int UserId { get; set; }
    }
}
