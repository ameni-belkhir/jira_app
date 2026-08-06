using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;

namespace Application.DTO
{
    public class UpdateProjectDto
    {
        [Required]
        public int Id { get; set; }

        [Required]
        public string Nom { get; set; } = string.Empty;

        public string Responsable { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;
    }
}
