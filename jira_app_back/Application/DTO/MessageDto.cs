using System;

namespace Application.DTO
{
    public class MessageDto
    {
        public int Id { get; set; }
        public int SenderId { get; set; }
        public string Contenu { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; }
        public bool Lu { get; set; }
        public int ConversationId { get; set; }
    }
}
