using System.ComponentModel.DataAnnotations;

namespace Application.DTO.Chat
{
    public class UpdateChatMessageDto
    {
        [Required(ErrorMessage = "Le contenu est requis.")]
        [MaxLength(4000, ErrorMessage = "Le message ne peut pas dépasser 4000 caractères.")]
        public string Content { get; set; } = string.Empty;
    }
}
