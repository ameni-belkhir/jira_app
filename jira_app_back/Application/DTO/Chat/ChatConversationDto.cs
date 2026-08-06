using System;
using System.Collections.Generic;

namespace Application.DTO.Chat
{
    public class ChatConversationDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsGroup { get; set; }
        public int? ProjectId { get; set; }
        public DateTime CreatedAt { get; set; }
        public ICollection<ChatUserDto> Members { get; set; } = new List<ChatUserDto>();
        public ChatMessageDto? LastMessage { get; set; }
        public int UnreadCount { get; set; }
    }
}
