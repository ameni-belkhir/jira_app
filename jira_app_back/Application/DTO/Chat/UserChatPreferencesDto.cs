using System;

namespace Application.DTO.Chat
{
    public class UserChatPreferencesDto
    {
        /// <summary>null = préférence globale par défaut.</summary>
        public Guid? ConversationId { get; set; }

        /// <summary>"preset" (liste prédéfinie) ou "custom" (upload).</summary>
        public string BackgroundType { get; set; } = "preset";

        /// <summary>Clé du fond prédéfini ou URL relative du fond uploadé.</summary>
        public string BackgroundKey { get; set; } = "trello";

        public string SentBubbleColor { get; set; } = "#465FFF";
        public string ReceivedBubbleColor { get; set; } = "#E2E8F0";

        public DateTime UpdatedAt { get; set; }
    }
}
