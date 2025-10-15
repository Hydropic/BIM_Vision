import { useEffect, useState } from "react";
import "./kanbanboard.css";
import TaskCard from "./kanbanboardTaskCard";
import { Status, statuses, Task } from "../utils/data-tasks";

const STORAGE_KEY = "kanban-tasks";

function KanbanBoard() {

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentlyHoveringOver, setCurrentlyHoveringOver] = useState<Status | null>(null);

  const columns = statuses.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.status === status),
  }));

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await fetch("/tasks.json");
        const data: Task[] = await response.json();
        setTasks(data);
      } catch (error) {
        console.error("Fehler beim Laden der Tasks:", error);
        setTasks([]);
      }
    };

    loadTasks();
  }, []);

  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error("Error saving tasks to localStorage:", error);
      }
    }
  }, [tasks, isInitialized]);

  const updateTask = (updatedTask: Task) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.issues[0].markup.topic.guid === updatedTask.issues[0].markup.topic.guid ? updatedTask : t))
    );
  };

  const deleteTask = (id: string) => {
    setTasks((prevTasks) => prevTasks.filter((t) => t.issues[0].markup.topic.guid !== id));
  };

  const addTask = (task: Task) => {
    setTasks((prevTasks) => [...prevTasks, task]);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: Status) => {
    e.preventDefault();
    setCurrentlyHoveringOver(null);
    const taskId = e.dataTransfer.getData("id");
    const draggedTask = tasks.find((task) => task.issues[0].markup.topic.guid === taskId);
    if (draggedTask && draggedTask.status !== newStatus) {
      updateTask({ ...draggedTask, status: newStatus });
    }
  };

  const handleDragEnter = (status: Status) => setCurrentlyHoveringOver(status);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <h1 className="text-center text-4xl font-bold py-6 text-gray-800">
        BCF Board
      </h1>

      <div className="flex flex-1 justify-center">
        <div className="flex divide-x w-full max-w-6xl mx-auto">
          {columns.map((column) => (
            <div
              key={column.status}
              className="flex-1 overflow-y-auto"
              onDrop={(e) => handleDrop(e, column.status)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => handleDragEnter(column.status)}
            >
              <div className="flex justify-between items-center text-xl font-semibold text-gray-700 bg-white px-4 py-2 border-b">
                <h2 className="capitalize">{column.status}</h2>
              </div>

              <div
                className={`min-h-[300px] p-2 ${
                  currentlyHoveringOver === column.status ? "bg-blue-100" : ""
                }`}
              >
                {column.tasks.length === 0 ? (
                  <div className="text-gray-400 italic text-center py-8">
                    No tasks
                  </div>
                ) : (
                  column.tasks.map((task) => (
                    <TaskCard
                      key={task.issues[0].markup.topic.guid}
                      task={task}
                      updateTask={updateTask}
                      deleteTask={deleteTask}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <a
        href="https://github.com/aridepai17/KANBAN-BOARD/tree/master"
        className="block text-center text-gray-200 hover:underline"
      >
        MIT License by aridepai17 2025
      </a>

    </div>
  );
}

export default KanbanBoard;
