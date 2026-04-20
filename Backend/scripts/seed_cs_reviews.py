import psycopg2
from datetime import datetime, timedelta
import random
from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.db import resolve_pooler_url

url = resolve_pooler_url(BACKEND_DIR / ".env")
conn = psycopg2.connect(url)
cur = conn.cursor()

reviews = [
    # CSCI-110 - Intro to Computer Science I
    ("CSCI-110", 2024, "Fall",   "Mr. Gary Nash",         "Honestly a great intro course. I came in knowing nothing about coding and left being able to write actual Python programs. Professor Nash breaks everything down step by step, never makes you feel dumb for asking questions."),
    ("CSCI-110", 2023, "Fall",   "Mr. Gary Nash",         "Not as easy as it sounds. The labs are where they get you. Show up, do the work early, and go to office hours. You will be fine though."),
    ("CSCI-110", 2024, "Spring", "Mr. Gary Nash",         "Good starting point. A little slow if you already have some coding background but the fundamentals matter. Wish they spent more time on loops."),
    ("CSCI-110", 2023, "Spring", "Dr. Zia Haque",         "Professor Haque made this class fun. Interactive, always responsive, and the projects were actually interesting. Best intro CS experience you can have at Fisk."),

    # CSCI-120 - Intro to Computer Science II
    ("CSCI-120", 2024, "Spring", "Mr. Gary Nash",         "Way harder than 110. The jump in difficulty is real. Make sure your loops and functions from 110 are solid before coming in here or you will be lost by week 3."),
    ("CSCI-120", 2023, "Fall",   "Mr. Gary Nash",         "I actually enjoyed this more than 110 because you start building real programs. Start assignments early though, some of them take way longer than expected."),
    ("CSCI-120", 2024, "Fall",   "Dr. Zia Haque",         "OOP was confusing at first but by the end of the semester everything clicked. Do not skip the lab sections, that is where it all ties together."),
    ("CSCI-120", 2023, "Spring", "Dr. Zia Haque",         "Mixed feelings. The content is important but the pacing felt off. Some weeks nothing to do then suddenly three assignments due the same day."),

    # CSCI-230 - Computer Organization
    ("CSCI-230", 2024, "Fall",   "Dr. Nicholas Umontuen", "Comp org was hard for absolutely no reason. Assembly language is not fun and the bitwise operations will make you question your life choices. I passed but barely."),
    ("CSCI-230", 2023, "Fall",   "Dr. Nicholas Umontuen", "This class will humble you real quick. Memory addressing, binary arithmetic, registers - it all stacks up fast. Go to every single class or you will be completely lost."),
    ("CSCI-230", 2024, "Spring", "Dr. Nicholas Umontuen", "One of the more interesting CS classes once it finally clicks. The low-level stuff is actually cool when you understand what is happening. Just do not fall behind."),
    ("CSCI-230", 2023, "Spring", "Mr. Tsehay Demeke",     "Hard class but the professor is patient. He will walk you through it in office hours if you go. Do not try to learn comp org the night before the exam. Learned that the hard way."),
    ("CSCI-230", 2024, "Fall",   "Dr. Nicholas Umontuen", "Honestly wish this was more hands-on. A lot of it felt like memorizing diagrams. The lab section helped a lot though so do not skip it."),

    # CSCI-240 - Data Structures
    ("CSCI-240", 2024, "Spring", "Dr. Zia Haque",         "Data structures is where people start dropping out of the CS major. Do not let that be you. Linked lists hurt, trees hurt more, but you need all of this. Use YouTube and study groups."),
    ("CSCI-240", 2023, "Fall",   "Dr. Zia Haque",         "I actually loved this class. Once you can visualize the data structures in your head it becomes almost fun. Big O notation is just pattern recognition once you practice enough."),
    ("CSCI-240", 2024, "Fall",   "Mr. Tsehay Demeke",     "Time complexity made zero sense to me until week 8. Do not give up. It is one of those things that suddenly just clicks and then you wonder why it was hard."),
    ("CSCI-240", 2023, "Spring", "Dr. Zia Haque",         "Brought my grade back up from a D to a B by the final. The key is doing every practice problem, not just reading slides. Implementation is everything in this class."),

    # CSCI-241 - Data Structures and Algorithms
    ("CSCI-241", 2024, "Spring", "Dr. Zia Haque",         "This is basically theory of computation lite. Algorithm analysis, sorting, graph traversal - it is a lot and it is not light. But if you are serious about CS you need this class."),
    ("CSCI-241", 2023, "Fall",   "Dr. Zia Haque",         "Big O and algorithmic complexity hit different in this class. Not impossible but you cannot coast. Spend real time on the problem sets or you will regret it at midterm."),
    ("CSCI-241", 2024, "Fall",   "Mr. Tsehay Demeke",     "Great class if you plan to do internships or go into industry. Everything companies ask in technical interviews is covered here. Take it seriously."),
    ("CSCI-241", 2023, "Spring", "Dr. Zia Haque",         "The dynamic programming section destroyed me. Had to relearn it three times before it stuck. Great professor though, always available to help outside class."),

    # CSCI-261 - Operating Systems
    ("CSCI-261", 2024, "Spring", "Dr. Nicholas Umontuen", "OS is heavy. You are basically learning how the entire computer works from the ground up. Processes, threads, scheduling, memory management. Rough but worth it."),
    ("CSCI-261", 2023, "Fall",   "Dr. Nicholas Umontuen", "Felt like learning a whole new language. Concepts build on each other so if you miss a week you feel it for the rest of the semester. Do not fall behind on this one."),
    ("CSCI-261", 2024, "Fall",   "Dr. Nicholas Umontuen", "Professor Umontuen knows this material cold. Class is tough but fair. The projects are where the real learning happens, not just the lectures."),
    ("CSCI-261", 2023, "Spring", "Mr. Tsehay Demeke",     "Hardest class in the major for me personally. Deadlock, virtual memory, file systems - it never slows down. Start every assignment the same day it gets posted."),

    # CSCI-265 - Database Management Systems
    ("CSCI-265", 2024, "Spring", "Mr. Tsehay Demeke",     "Database management was genuinely one of my favorite classes at Fisk. SQL just makes sense and once it clicks it is actually satisfying. Calm, organized, no unnecessary stress."),
    ("CSCI-265", 2023, "Fall",   "Mr. Tsehay Demeke",     "Coming from OS and comp org this was a breath of fresh air. The professor does not stress you out and the projects are actually useful for real jobs. Highly recommend."),
    ("CSCI-265", 2024, "Fall",   "Mr. Tsehay Demeke",     "Easy A if you keep up with the work. Normalization took me a bit to understand but office hours cleared it up fast. One of the better CS classes offered."),
    ("CSCI-265", 2023, "Spring", "Dr. Nicholas Umontuen", "You will use SQL everywhere after this class, even in other courses. Content is practical, workload is manageable. Great class, great professor."),
    ("CSCI-265", 2024, "Spring", "Mr. Tsehay Demeke",     "Every CS student should take this. Super relevant, not overly difficult, and the professor actually cares if you understand. Way more enjoyable than I expected."),
]

# Stagger created_at across the past ~2 years
random.seed(42)
base = datetime(2023, 9, 1)
offsets = sorted(random.randint(0, 500) for _ in reviews)

inserted = 0
for (code, year, term, prof, comment), offset in zip(reviews, offsets):
    ts = base + timedelta(days=offset)
    cur.execute(
        """
        INSERT INTO course_reviews (course_code, year_taken, term_taken, professor, comment, created_at)
        SELECT %s, %s, %s, %s, %s, %s
        WHERE NOT EXISTS (
            SELECT 1
            FROM course_reviews
            WHERE course_code = %s
              AND year_taken = %s
              AND term_taken = %s
              AND professor = %s
              AND comment = %s
        )
        """,
        (code, year, term, prof, comment, ts, code, year, term, prof, comment),
    )
    inserted += cur.rowcount

conn.commit()
conn.close()
print(f"Inserted {inserted} new reviews across 7 CS courses")
