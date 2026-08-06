using System;
using System.Collections.Generic;

namespace Domain.Entity
{
    public class ChatConversation
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = string.Empty;
        public bool IsGroup { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Conversation optionnellement liée à un projet
        public int? ProjectId { get; set; }
        public Project? Project { get; set; }

        // Membres de la conversation
        public ICollection<ConversationMember> Members { get; set; } = new List<ConversationMember>();

        // Messages de la conversation
        public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
    }
}
