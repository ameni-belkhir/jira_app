using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Application.Interfaces
{
    public interface IFileStorageService
    {
        Task<string> SaveProfileImageAsync(IFormFile file);
    }
}
