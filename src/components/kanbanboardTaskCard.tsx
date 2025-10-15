import { Task } from '../utils/data-tasks'
import './kanbanboard.css'

interface TaskCardProps {
  task: Task
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
}

function TaskCard({ task, updateTask, deleteTask }: TaskCardProps) {

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('id', task.issues[0].markup.topic.guid)
  }
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-green-600'
      case 'medium':
        return 'bg-yellow-500'
      case 'high':
        return 'bg-red-600'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="border bg-black text-white p-4 mb-4 rounded-md shadow-lg cursor-move transition-transform duration-150 hover:scale-[1.01]"
    >
      <div className="flex justify-between items-start">
        <div>
          
          <h3 className="text-base font-bold mb-2">{task.issues[0].markup.topic.title}</h3>
          
          <p>Author: {task.issues[0].markup.topic.creation_author}</p>
          <p>Date:  {task.issues[0].markup.topic.creation_date}</p>

          <span
            className={`inline-block px-2 py-1 text-xs rounded-full text-white ${getPriorityColor(
              task.issues[0].markup.topic.priority
            )}`}
          >
            Priority: {task.issues[0].markup.topic.priority}
          </span>



        </div>

        <button
          onClick={() => deleteTask(task.issues[0].markup.topic.guid)}
          className="text-gray-500 hover:text-gray-100 text-lg"
          title="Delete Task"
        >
        ✕
        </button>
      </div>
    </div>
  )
}


export default TaskCard
