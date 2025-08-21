const todoFile = Bun.file("todo.md");
const todoContent = await todoFile.text();
console.log(todoContent);