using System;

namespace Domain.Entity
{
    /// <summary>
    /// Préférences d'affichage du chat d'un utilisateur.
    /// ConversationId null = préférence globale par défaut,
    /// sinon préférence spécifique à une conversation.
    /// </summary>
    public class UserChatPreferences
    {
        public int Id { get; set; }

        public int UserId { get; set; }
        public User? User { get; set; }

        public Guid? ConversationId { get; set; }
        public ChatConversation? Conversation { get; set; }

        /// <summary>"preset" (liste prédéfinie) ou "custom" (upload).</summary>
        public string BackgroundType { get; set; } = "preset";

        /// <summary>Clé du fond prédéfini ou URL relative du fond uploadé.</summary>
        public string BackgroundKey { get; set; } = "trello";

        public string SentBubbleColor { get; set; } = "#465FFF";
        public string ReceivedBubbleColor { get; set; } = "#E2E8F0";

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
