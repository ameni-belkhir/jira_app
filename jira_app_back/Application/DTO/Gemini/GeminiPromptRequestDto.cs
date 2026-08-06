using System.ComponentModel.DataAnnotations;

namespace Application.DTO.Gemini
{
    public class GeminiPromptRequestDto
    {
        [Required(ErrorMessage = "Le prompt est requis.")]
        public string Prompt { get; set; } = string.Empty;
    }
}
