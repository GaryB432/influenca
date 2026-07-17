using Influenca.Win.Commands;

if (args.Length == 0)
{
    Console.WriteLine("Usage: influenca-win <hello|drive>");
    return;
}

switch (args[0].ToLowerInvariant())
{
    case "hello":
        HelloCommand.Run();
        break;
    case "drive":
        DriveCommand.Run();
        break;
    default:
        Console.WriteLine("Unknown command.");
        break;
}
