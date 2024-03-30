const chalk = require('chalk')

export function welcomeMessage() {
  console.log(
    chalk.yellow(
      '\n' +
        ' __                  __                      __ \n' +
        '/  |                /  |                    /  |\n' +
        '$$ |____    ______  $$ | __    __  _______  $$/ \n' +
        '$$      \\  /      \\ $$ |/  |  /  |/       \\ /  |\n' +
        '$$$$$$$  | $$$$$$  |$$ |$$ |  $$ |$$$$$$$  |$$ |\n' +
        '$$ |  $$ | /    $$ |$$ |$$ |  $$ |$$ |  $$ |$$ |\n' +
        '$$ |__$$ |/$$$$$$$ |$$ |$$ \\__$$ |$$ |  $$ |$$ |\n' +
        '$$    $$/ $$    $$ |$$ |$$    $$/ $$ |  $$ |$$ |\n' +
        '$$$$$$$/   $$$$$$$/ $$/  $$$$$$/  $$/   $$/ $$/ \n' +
        '                                                \n'
    )
  )

  console.log(
    chalk.magenta(
      '\n' +
        '                 ,-""""-.\n' +
        "               ,'      _ `.\n" +
        '              /       )_)  \\\n' +
        '             :              :\n' +
        '             \\              /\n' +
        '              \\            /\n' +
        "               `.        ,'\n" +
        "                 `.    ,'\n" +
        "                   `.,'\n" +
        '                    /\\`.   ,-._\n' +
        "                        `-'    \\__\n" +
        '                             .\n' +
        '              s                \\\n' +
        '                               \\\\\n' +
        '                                \\\\\n' +
        '                                 >\\/7\n' +
        "                             _.-(6'  \\\n" +
        '                            (=___._/` \\\n' +
        '                                 )  \\ |\n' +
        '                                /   / |\n' +
        '                               /    > /\n' +
        '                              j    < _\\\n' +
        "                          _.-' :      ``.\n" +
        '                          \\ r=._\\        `.\n'
    )
  )

  console.log(chalk.yellow('\nPlease wait...'))
  console.log(
    chalk.red(
      'This is an experimental project. Use at your own risk. No financial advice is given.'
    )
  )
  console.log(chalk.white('\n\n'))
}
