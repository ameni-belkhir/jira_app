using System.ComponentModel.DataAnnotations;

namespace Application.DTO
{
    /// <summary>
    /// DTO utilisé par l'utilisateur pour mettre à jour SON profil.
    /// Ne contient que les champs modifiables : prénom et nom.
    /// L'ID est injecté via l'URL de routage, pas via le body.
    /// </summary>
    public class UpdateProfileDto
    {
        [Required]
        public string Nom { get; set; } = string.Empty;

        [Required]
        public string Prenom { get; set; } = string.Empty;
    }
}

