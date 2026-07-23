using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.Services
{
    public interface IFileStorageService
    {
        Task<string> SaveProfileImageAsync(IFormFile file);
    }
}
