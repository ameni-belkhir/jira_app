using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Application.DTO.Chat
{
    public class CreateChatConversationDto
    {
        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public bool IsGroup { get; set; }

        public int? ProjectId { get; set; }

        // Identifiants des autres membres à ajouter (le créateur est ajouté automatiquement)
        public ICollection<int> MemberUserIds { get; set; } = new List<int>();
    }
}
