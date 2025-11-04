def b_str(x):
    if x:
        return "true"
    else:
        return "false"

with open("testAnswers.txt", "r") as file:

    with open("out.json", "w") as out:

        out.write("{\n")

        pref = 'SZ2021'

        for i, line in enumerate(file):
            i += 1
            str_i = ""
            if i > 9:
                str_i = str(i)
            else:
                str_i = "0" + str(i)

            answer = line.strip()
            chars = ["A", "B", "C", "D", "E", "F"]
            type = ""
            if answer[0] in chars:
                type = "choose"
            else:
                type = "input"

            if type == "choose":
                answers_dict = {}
                for c in chars:
                    answers_dict[c] = False
                for i in range(len(answer)):
                    answers_dict[answer[0]] = True

                out.write(f'"{pref}{str_i}": {{ "type": "{type}", "odp": {{ "A": {b_str(answers_dict["A"])}, "B": {b_str(answers_dict["B"])}, "C": {b_str(answers_dict["C"])}, "D": {b_str(answers_dict["D"])} }}, "group": "" }},\n')
            else:
                answers = answer
                out.write(f'"{pref}{str_i}": {{ "type": "{type}", "odp": [{{"title": "Twoja odpowiedź", "answer": "{answers}"}}], "group": "" }},\n')



        out.write("}\n")